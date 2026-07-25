/**
 * Google Drive integration — used to store generated shipping label PDFs.
 *
 * Auth: Google Service Account credentials, supplied via environment variables
 * (no credentials JSON file committed to the repo):
 *
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   — the service account's client_email
 *   GOOGLE_PRIVATE_KEY             — the service account's private_key
 *                                    (with literal `\n` sequences — they are
 *                                    unescaped below)
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID  — optional. If set, the "Godhara Labels"
 *                                    root folder is created inside this
 *                                    folder (e.g. a Shared Drive folder the
 *                                    service account has access to). If not
 *                                    set, the root folder is created in the
 *                                    service account's own Drive space.
 *
 * Folder layout created automatically:
 *   Godhara Labels/
 *     └── 2026/
 *          └── July/
 *               └── label-GDH-123456.pdf
 */

import { google } from 'googleapis';
import fs from 'fs';

const ROOT_FOLDER_NAME = 'Godhara Labels';

let driveClient: ReturnType<typeof google.drive> | null = null;
let authConfigured = false;

function ensureDriveConfigured(): boolean {
  if (authConfigured) return true;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.warn(
      '[GoogleDrive] Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY env vars — Drive uploads disabled.'
    );
    return false;
  }

  // Env vars usually store the key with literal "\n" — convert to real newlines.
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  authConfigured = true;
  console.log(`[GoogleDrive] Configured for service account: ${clientEmail}`);
  return true;
}

/**
 * Find a folder by name inside a given parent (or Drive root if parentId is undefined).
 * Returns the folder ID, or null if not found.
 */
async function findFolder(name: string, parentId?: string): Promise<string | null> {
  if (!driveClient) return null;
  const parentClause = parentId ? `and '${parentId}' in parents` : "and 'root' in parents";
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false ${parentClause}`;

  const res = await driveClient.files.list({
    q,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = res.data.files || [];
  return files.length > 0 ? (files[0].id as string) : null;
}

/**
 * Create a folder with the given name inside a given parent (or Drive root).
 * Returns the new folder ID.
 */
async function createFolder(name: string, parentId?: string): Promise<string> {
  if (!driveClient) throw new Error('Google Drive client not configured');

  const fileMetadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) fileMetadata.parents = [parentId];

  const res = await driveClient.files.create({
    requestBody: fileMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });

  return res.data.id as string;
}

/**
 * Find a folder by name under a parent, creating it if it doesn't exist yet.
 */
async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

// Simple in-memory cache so we don't re-query Drive for the same YYYY/Month
// folder chain on every single order in a hot process.
const folderCache = new Map<string, string>();

/**
 * Ensures the "Godhara Labels/YYYY/Month" folder chain exists, creating any
 * missing folders along the way. Returns the deepest (Month) folder's ID.
 */
export async function ensureLabelFolderForDate(date: Date = new Date()): Promise<string | null> {
  if (!ensureDriveConfigured()) return null;

  const year = String(date.getFullYear());
  const month = date.toLocaleString('en-US', { month: 'long' });
  const cacheKey = `${year}/${month}`;

  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  try {
    const topParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || undefined;

    const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME, topParentId);
    const yearId = await findOrCreateFolder(year, rootId);
    const monthId = await findOrCreateFolder(month, yearId);

    folderCache.set(cacheKey, monthId);
    return monthId;
  } catch (err: any) {
    console.error('[GoogleDrive] Failed to ensure folder chain:', err?.message || err);
    return null;
  }
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

/**
 * Upload a local file to Drive inside the given folder. Returns the file ID
 * and a shareable "view" link. Sets the file to be readable via link so
 * admins can open it directly.
 */
export async function uploadFileToDriveFolder(
  localFilePath: string,
  filename: string,
  mimeType: string,
  folderId: string
): Promise<DriveUploadResult> {
  if (!driveClient) throw new Error('Google Drive client not configured');

  const res = await driveClient.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const fileId = res.data.id as string;

  // Make the file viewable by anyone with the link (so "Open Google Drive"
  // works for admins without needing to be individually shared).
  try {
    await driveClient.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch (err: any) {
    console.warn('[GoogleDrive] Could not set public read permission:', err?.message || err);
  }

  const webViewLink = res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  return { fileId, webViewLink };
}

/**
 * High-level helper: given a local PDF file already generated on disk,
 * upload it into the correct "Godhara Labels/YYYY/Month" folder.
 * Returns null (without throwing) if Drive isn't configured, so callers can
 * treat Drive upload as best-effort and never block order processing.
 */
export async function uploadShippingLabelToDrive(
  localFilePath: string,
  filename: string
): Promise<DriveUploadResult | null> {
  if (!ensureDriveConfigured()) return null;
  try {
    const folderId = await ensureLabelFolderForDate(new Date());
    if (!folderId) return null;
    return await uploadFileToDriveFolder(localFilePath, filename, 'application/pdf', folderId);
  } catch (err: any) {
    console.error('[GoogleDrive] Shipping label upload failed:', err?.message || err);
    return null;
  }
}

/**
 * Used by GET /api/test-drive — uploads a small test.txt file into the
 * "Godhara Labels/YYYY/Month" folder chain and returns its Drive URL.
 */
export async function uploadDriveTestFile(): Promise<DriveUploadResult | null> {
  if (!ensureDriveConfigured()) return null;

  const os = await import('os');
  const path = await import('path');
  const tmpPath = path.join(os.tmpdir(), `godhara-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, `Godhara Google Drive test file\nGenerated: ${new Date().toISOString()}\n`);

  try {
    const folderId = await ensureLabelFolderForDate(new Date());
    if (!folderId) return null;
    const result = await uploadFileToDriveFolder(tmpPath, 'test.txt', 'text/plain', folderId);
    return result;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

export function isDriveConfigured(): boolean {
  return ensureDriveConfigured();
}
