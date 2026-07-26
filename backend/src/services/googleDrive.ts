/**
 * Google Drive integration — used to store generated Invoice and Shipping
 * Label PDFs for each order.
 *
 * Auth: Google OAuth2 (refresh-token flow only), supplied via environment
 * variables (no credentials JSON / service-account key file committed to
 * the repo):
 *
 *   GOOGLE_CLIENT_ID              — OAuth2 client ID
 *   GOOGLE_CLIENT_SECRET          — OAuth2 client secret
 *   GOOGLE_DRIVE_REDIRECT_URI     — OAuth2 redirect URI registered with the
 *                                    client (must match the one used in the
 *                                    consent screen redirect, e.g.
 *                                    https://your-app.example.com/api/google-drive/callback)
 *   GOOGLE_DRIVE_REFRESH_TOKEN    — long-lived refresh token obtained once
 *                                    via the /api/google-drive/connect ->
 *                                    /api/google-drive/callback flow. Access
 *                                    tokens are minted from this refresh
 *                                    token automatically and refreshed
 *                                    transparently by the googleapis client
 *                                    whenever they expire.
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID — optional. If set, the "Godhara Labels"
 *                                    root folder is created/looked up inside
 *                                    this Drive folder instead of "My Drive"
 *                                    root.
 *
 * This module is completely separate from — and does not affect — the
 * existing Google Login (OAuth2Client from google-auth-library), JWT
 * sessions, OTP, or admin/customer auth flows defined elsewhere in the app.
 * There is no Service Account auth path here — OAuth2 refresh-token is the
 * only supported authentication method.
 *
 * Folder layout created automatically:
 *   Godhara Labels/
 *     └── 2026/
 *          └── July/
 *               ├── invoice-GDH123456.pdf
 *               └── shipping-label-GDH123456.pdf
 */

import { google, drive_v3 } from 'googleapis';
import fs from 'fs';

const ROOT_FOLDER_NAME = 'Godhara Labels';

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export type DriveDocumentKind = 'invoice' | 'shipping-label';

let driveClient: drive_v3.Drive | null = null;
let oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;
let authConfigured = false;

/**
 * Lazily builds the OAuth2 client + Drive client from environment variables.
 * Returns true if Drive is usable, false (without throwing) if the required
 * env vars are missing — callers must treat Drive as best-effort and never
 * let a missing/broken Drive config block order creation.
 */
function ensureDriveConfigured(): boolean {
  if (authConfigured) return true;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
    console.warn(
      '[GoogleDrive] Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_DRIVE_REDIRECT_URI / GOOGLE_DRIVE_REFRESH_TOKEN env vars — Drive uploads disabled.'
    );
    return false;
  }

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // googleapis automatically exchanges the refresh_token for a fresh
  // access_token whenever the current one is missing/expired, so no manual
  // refresh handling is required here.
  driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  authConfigured = true;
  console.log('[GoogleDrive] Configured via OAuth2 refresh token.');
  return true;
}

/**
 * Returns a configured OAuth2Client instance to be used by the
 * /api/google-drive/connect and /api/google-drive/callback routes for the
 * initial consent + code exchange flow (i.e. to generate a new refresh
 * token). This is independent of the app's existing Google Login OAuth2
 * client.
 */
export function getDriveOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_DRIVE_REDIRECT_URI environment variables.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
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

  const fileMetadata: drive_v3.Schema$File = {
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
 * missing folders along the way. Returns the deepest (Month) folder's ID, or
 * null if Drive isn't configured or the folder chain could not be created.
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GoogleDrive] Failed to ensure folder chain:', message);
    return null;
  }
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[GoogleDrive] Could not set public read permission:', message);
  }

  const webViewLink = res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  return { fileId, webViewLink };
}

/**
 * Builds the standardized Drive filename for an order document, e.g.
 * "invoice-GDH123456.pdf" / "shipping-label-GDH123456.pdf".
 */
export function buildOrderDocumentFilename(kind: DriveDocumentKind, orderId: string): string {
  const normalizedOrderId = orderId.replace(/-/g, '');
  return `${kind}-${normalizedOrderId}.pdf`;
}

/**
 * High-level helper: given a local PDF already generated on disk, upload it
 * into the correct "Godhara Labels/YYYY/Month" folder using the standardized
 * filename convention. Returns null (without throwing) if Drive isn't
 * configured or the upload fails, so callers can always treat Drive upload
 * as best-effort and never block order processing on it.
 */
export async function uploadOrderDocumentToDrive(
  localFilePath: string,
  kind: DriveDocumentKind,
  orderId: string
): Promise<DriveUploadResult | null> {
  if (!ensureDriveConfigured()) return null;
  try {
    const folderId = await ensureLabelFolderForDate(new Date());
    if (!folderId) return null;
    const filename = buildOrderDocumentFilename(kind, orderId);
    return await uploadFileToDriveFolder(localFilePath, filename, 'application/pdf', folderId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GoogleDrive] ${kind} upload failed for order ${orderId}:`, message);
    return null;
  }
}

export function isDriveConfigured(): boolean {
  return ensureDriveConfigured();
}

/**
 * Used by GET /api/test-drive (dev/admin-only smoke test) — uploads a small
 * test.txt file into the "Godhara Labels/YYYY/Month" folder chain and
 * returns its Drive URL.
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
    return await uploadFileToDriveFolder(tmpPath, 'test.txt', 'text/plain', folderId);
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}
