import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'data', 'documents');

// Ensure storage directories exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export function getInvoicePath(orderId: string): string {
  return path.join(STORAGE_DIR, `invoice-${orderId}.pdf`);
}

export function getLabelPath(orderId: string): string {
  return path.join(STORAGE_DIR, `label-${orderId}.pdf`);
}

// Generate Barcode using bwip-js
async function generateBarcodeBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'code128',       // Barcode type
        text: text,            // Text to encode
        scale: 2,              // Scale factor
        height: 12,            // Height in mm
        includetext: false,    // No text embedded inside barcode
        textxalign: 'center',
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png);
      }
    );
  });
}

// Helper to retrieve the official company brand logo image path
function getCompanyLogoPath(): string | null {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');

  if (fs.existsSync(logoPath)) {
    console.log(`[PDF Generator] Loaded company logo image from: ${logoPath}`);
    return logoPath;
  }

  console.warn('[PDF Generator] Warning: No company logo found at public/logo.png.');
  return null;
}
const ASSETS_DIR = path.join(process.cwd(), 'assets');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const defaultLogoPath = path.join(ASSETS_DIR, 'logo.png');

if (!fs.existsSync(defaultLogoPath)) {
  const defaultPngBase64 = '...';
  try {
    fs.writeFileSync(defaultLogoPath, Buffer.from(defaultPngBase64, 'base64'));
    console.log('[PDF Generator] Successfully initialized default company logo PNG under "assets/logo.png"');
  } catch (err) {
    console.error('[PDF Generator] Failed to initialize default company logo file assets/logo.png:', err);
  }
}

const safe = (val: any, fallback = 'N/A') =>
  val === undefined || val === null || val === '' ? fallback : val;

// ======================================================================
// Generate a Tax Invoice PDF — "Studio Salford" style layout, fitted
// to a single A5 page. Company wordmark top-left. "To" (customer) and
// "From" (company) blocks both stacked on the RIGHT side. Every
// section auto-tightens its spacing so the whole invoice — header,
// itemised table, totals and footer — always lands on one page.
// ======================================================================
export async function generateInvoicePDF(order: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const destPath = getInvoicePath(order.id);

      // A5 Portrait: 148mm x 210mm = 419.53 x 595.28 pt
      const PAGE_WIDTH = 419.53;
      const PAGE_HEIGHT = 595.28;
      const MARGIN = 26;
      const LEFT = MARGIN;
      const RIGHT = PAGE_WIDTH - MARGIN;
      const CONTENT_WIDTH = RIGHT - LEFT;

      const doc = new PDFDocument({ margin: MARGIN, size: [PAGE_WIDTH, PAGE_HEIGHT] });
      const stream = fs.createWriteStream(destPath);
      doc.pipe(stream);

      // ---------- Palette ----------
      const primaryColor = '#6B2D0E';   // deep brown (wordmark / headings)
      const secondaryColor = '#2C1810'; // dark brown text
      const textMuted = '#6B6157';
      const ruleColor = '#1A1A1A';      // strong rule, like the reference
      const softRule = '#D9C4A3';
      const tableHeaderBg = '#6B2D0E';
      const white = '#FFFFFF';
      const rowAltBg = '#F7F1E6';

      const addr = order.shippingAddress || {};
      const rupee = (n: number) => `Rs. ${Number(n || 0).toFixed(2)}`;

      // ==================================================================
      // HEADER — wordmark left, "To…" + "From:" stacked on the right
      // ==================================================================
      const rightColX = LEFT + 148;
      const rightColW = RIGHT - rightColX;

      let leftY = MARGIN;
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#111111').text('+', LEFT, leftY);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111')
        .text('Godhara', LEFT + 14, leftY + 1, { width: 130 });
      doc.font('Helvetica').fontSize(6.3).fillColor(primaryColor)
        .text('Gau Traditional Ayurvedic Products', LEFT, leftY + 20, { width: 140 });

      // -- "To..." block (customer) --
      let rY = MARGIN;
      const rightLine = (text: string, opts: { bold?: boolean; size?: number; color?: string; gap?: number } = {}) => {
        const { bold = false, size = 7, color = secondaryColor, gap = 9 } = opts;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color)
          .text(text, rightColX, rY, { width: rightColW, align: 'right' });
        rY += gap;
      };

      rightLine('To…', { bold: true, size: 8, color: '#111111', gap: 11 });
      rightLine(`Name: ${safe(addr.name)}`, { bold: true, size: 7.3, color: '#111111' });
      rightLine(`Contact: ${safe(addr.phone)}`, { bold: true, size: 7.3, color: '#111111' });
      rightLine('Address:', { bold: true, size: 7.3, color: '#111111' });
      rightLine(safe(addr.street));
      rightLine(`${safe(addr.city)}, ${safe(addr.state)} - ${safe(addr.pincode)}`);
      rightLine(`Email: ${safe(addr.email)}`);

      rY += 6;
      rightLine('From:', { bold: true, size: 8, color: '#111111', gap: 11 });
      rightLine('Godhara Swadesi Products', { bold: true, size: 7.3 });
      rightLine('Contact: +91 7661055143', { size: 6.8 });
      rightLine('4-3-18, Chaman Gally, Old Banswada,', { size: 6.8 });
      rightLine('Banswada, Dist: Kamareddy - 503187', { size: 6.8 });

      // -- Invoice meta, under the wordmark on the left --
      leftY += 38;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryColor)
        .text(`INVOICE NO: ${order.invoiceNumber || 'INV-' + String(order.id).replace('GDH-', '')}`, LEFT, leftY, { width: 130 });
      leftY += 11;
      doc.font('Helvetica').fontSize(7).fillColor(textMuted)
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, LEFT, leftY);
      leftY += 10;
      doc.font('Helvetica').fontSize(7).fillColor(textMuted)
        .text(`Payment Status: ${order.paymentStatus || 'PAID'}`, LEFT, leftY);
      leftY += 10;
      doc.font('Helvetica').fontSize(7).fillColor(textMuted)
        .text(`Tracking No: ${order.trackingNumber || 'N/A'}`, LEFT, leftY);

      const headerBottom = Math.max(rY, leftY) + 8;

      // ==================================================================
      // TABLE — column widths tuned for A5 (371pt content width)
      // ==================================================================
      const items = Array.isArray(order.items) ? order.items : [];

      // Reserve space below the table for totals + footer so everything
      // still lands on one page, then size each row to fit what's left.
      const footerReserve = 172;
      const tableHeaderH = 16;
      const availableForRows = PAGE_HEIGHT - MARGIN - headerBottom - tableHeaderH - footerReserve;
      const rowH = items.length > 0
        ? Math.max(11, Math.min(15, availableForRows / items.length))
        : 15;
      const rowFont = rowH < 13 ? 6.6 : 7.3;

      const colSNoX = LEFT + 4;
      const colDescX = LEFT + 24;
      const colQtyX = LEFT + 190;
      const colRateX = LEFT + 222;
      const colAmtX = LEFT + 280;
      const colDescW = colQtyX - colDescX - 4;
      const colAmtW = RIGHT - colAmtX;

      const tableTop = headerBottom;
      doc.rect(LEFT, tableTop, CONTENT_WIDTH, tableHeaderH).fill(tableHeaderBg);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(white);
      doc.text('S.No', colSNoX, tableTop + 4.5, { width: 18 });
      doc.text('Description', colDescX, tableTop + 4.5, { width: colDescW });
      doc.text('Qty', colQtyX, tableTop + 4.5, { width: 28, align: 'center' });
      doc.text('Rate', colRateX, tableTop + 4.5, { width: 54, align: 'right' });
      doc.text('Amount', colAmtX, tableTop + 4.5, { width: colAmtW, align: 'right' });

      let currentTop = tableTop + tableHeaderH;
      items.forEach((item: any, i: number) => {
        if (i % 2 === 1) doc.rect(LEFT, currentTop, CONTENT_WIDTH, rowH).fill(rowAltBg);

        const labelText = item.packageSize ? `${item.name} (${item.packageSize})` : item.name;
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);

        doc.font('Helvetica').fontSize(rowFont).fillColor(secondaryColor);
        doc.text((i + 1).toString(), colSNoX, currentTop + rowH / 2 - rowFont / 2, { width: 18 });
        doc.text(safe(labelText, 'Item'), colDescX, currentTop + rowH / 2 - rowFont / 2, { width: colDescW, height: rowH });
        doc.text(qty.toString(), colQtyX, currentTop + rowH / 2 - rowFont / 2, { width: 28, align: 'center' });
        doc.text(rupee(unitPrice), colRateX, currentTop + rowH / 2 - rowFont / 2, { width: 54, align: 'right' });
        doc.text(rupee(qty * unitPrice), colAmtX, currentTop + rowH / 2 - rowFont / 2, { width: colAmtW, align: 'right' });

        currentTop += rowH;
      });

      doc.moveTo(LEFT, currentTop).lineTo(RIGHT, currentTop).strokeColor(ruleColor).lineWidth(1).stroke();
      currentTop += 8;

      // ==================================================================
      // DUE DATE (left) + TOTALS (right)
      // ==================================================================
      const totalsTop = currentTop;
      const dueDate = order.dueDate ? new Date(order.dueDate).toLocaleDateString() : new Date(order.createdAt).toLocaleDateString();

      doc.font('Helvetica').fontSize(7).fillColor(secondaryColor)
        .text(`Due Date: ${dueDate}`, LEFT, totalsTop, { width: 140 });
      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted)
        .text(`Razorpay ID: ${order.razorpayPaymentId || 'N/A'}`, LEFT, totalsTop + 11, { width: 140 });
      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted)
        .text('Delivery: Gaushala Cargo Logistics', LEFT, totalsTop + 22, { width: 140 });

      const totalLabelX = colRateX - 60;
      const totalValX = colAmtX;
      const totalValW = colAmtW;
      let tY = totalsTop;

      doc.font('Helvetica').fontSize(7.3).fillColor(secondaryColor);
      doc.text('Sub-Total', totalLabelX, tY, { width: colRateX - totalLabelX, align: 'right' });
      doc.text(rupee(order.subtotal), totalValX, tY, { width: totalValW, align: 'right' });
      tY += 12;

      doc.text('Shipping', totalLabelX, tY, { width: colRateX - totalLabelX, align: 'right' });
      doc.text(order.shippingCharge === 0 ? 'FREE' : rupee(order.shippingCharge), totalValX, tY, { width: totalValW, align: 'right' });
      tY += 12;

      const gstAmount = order.subtotal * 0.05;
      doc.text('Tax (GST 5%)', totalLabelX, tY, { width: colRateX - totalLabelX, align: 'right' });
      doc.text(rupee(gstAmount), totalValX, tY, { width: totalValW, align: 'right' });
      tY += 10;

      doc.moveTo(totalLabelX, tY + 5).lineTo(RIGHT, tY + 5).strokeColor(ruleColor).lineWidth(0.75).stroke();
      tY += 11;

      doc.rect(totalLabelX - 6, tY - 3, RIGHT - totalLabelX + 6, 17).fill(tableHeaderBg);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(white);
      doc.text('TOTAL', totalLabelX, tY + 1, { width: colRateX - totalLabelX, align: 'right' });
      doc.text(rupee(order.total), totalValX, tY + 1, { width: totalValW, align: 'right' });

      currentTop = Math.max(totalsTop + 36, tY + 17) + 14;

      // ==================================================================
      // FOOTER — Contact / Payment Info
      // ==================================================================
      doc.moveTo(LEFT, currentTop).lineTo(RIGHT, currentTop).strokeColor(softRule).lineWidth(0.5).stroke();
      currentTop += 12;

      const footerColW = CONTENT_WIDTH / 2 - 6;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryColor).text('Contact', LEFT, currentTop);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryColor).text('Payment Info', LEFT + footerColW + 12, currentTop);
      currentTop += 12;

      doc.font('Helvetica').fontSize(6.8).fillColor(secondaryColor);
      doc.text('+91 7661055143', LEFT, currentTop, { width: footerColW });
      doc.text('Method: ' + safe(order.paymentMethod, 'Online'), LEFT + footerColW + 12, currentTop, { width: footerColW });
      currentTop += 10;
      doc.text('support@godhara.com', LEFT, currentTop, { width: footerColW });
      doc.text(`Payment Date: ${order.paymentDate ? new Date(order.paymentDate).toLocaleDateString() : 'N/A'}`, LEFT + footerColW + 12, currentTop, { width: footerColW });
      currentTop += 10;
      doc.text('4-3-18, Chaman Gally, Banswada,', LEFT, currentTop, { width: footerColW });
      doc.text('www.godhara.com', LEFT + footerColW + 12, currentTop, { width: footerColW });
      currentTop += 9;
      doc.text('Telangana 503187', LEFT, currentTop, { width: footerColW });

      // Thank-you strip + tiny credit, pinned to the very bottom of the A5 page
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(primaryColor)
        .text('Thank you for shopping with Godhara!', LEFT, PAGE_HEIGHT - 38, { width: CONTENT_WIDTH, align: 'center' });
      doc.font('Helvetica').fontSize(6).fillColor('#AAAAAA')
        .text('Powering Indian Vedic Traditions. Built by Nexakite.', LEFT, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH, align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(destPath));
      stream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

// Generate a Premium A5 Shipping Label + Invoice PDF
export async function generateShippingLabelPDF(order: any): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const destPath = getLabelPath(order.id);

      // A5 Portrait dimensions: 148mm x 210mm = 419.53 x 595.28 points
      const PAGE_WIDTH = 419.53;
      const PAGE_HEIGHT = 595.28;
      const MARGIN = 24;
      const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

      // Single-page guarantee: this document is never paginated, so no
      // addPage() call exists anywhere below — every section is sized and
      // positioned to always fit within one A5 sheet.
      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: MARGIN,
      });

      const stream = fs.createWriteStream(destPath);
      doc.pipe(stream);

      // ---------- Theme: Brown + Gold, Modern Luxury (unchanged) ----------
      const primaryColor = '#5C2A0E';      // deep brown
      const goldColor = '#C9973E';         // gold accent
      const goldLight = '#E7C77A';         // light gold border
      const textDark = '#2C1810';          // dark brown text
      const textMuted = '#7A6A5D';         // muted brown-grey
      const creamBg = '#FBF6EE';           // soft cream background
      const rowAltBg = '#F5EAD6';          // alternating row tint
      const white = '#FFFFFF';

      // ---------- Helpers ----------
      const rupee = (n: number) => `Rs. ${Number(n || 0).toFixed(2)}`;

      const drawRoundedBox = (
        x: number,
        y: number,
        w: number,
        h: number,
        fill: string,
        stroke?: string,
        radius = 6
      ) => {
        doc.roundedRect(x, y, w, h, radius);
        if (fill) doc.fill(fill);
        if (stroke) {
          doc.roundedRect(x, y, w, h, radius).strokeColor(stroke).lineWidth(0.75).stroke();
        }
      };

      let cursorY = MARGIN;

      // ================= HEADER (compact) =================
      const logoSize = 30;
      const logoPath = getCompanyLogoPath();
      if (logoPath) {
        doc.image(logoPath, MARGIN, cursorY, { width: logoSize });
      } else {
        drawRoundedBox(MARGIN, cursorY, logoSize, logoSize, creamBg, goldLight, 6);
        doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor).text('G', MARGIN, cursorY + 9, { width: logoSize, align: 'center' });
      }

      doc.font('Helvetica-Bold').fontSize(13).fillColor(primaryColor)
        .text('GODHARA', MARGIN + logoSize + 8, cursorY + 1);
      doc.font('Helvetica').fontSize(7).fillColor(goldColor)
        .text('Swadesi Products', MARGIN + logoSize + 8, cursorY + 16);

      // Right side title
      doc.font('Helvetica-Bold').fontSize(13).fillColor(primaryColor)
        .text('SHIPPING LABEL', MARGIN, cursorY + 1, { width: CONTENT_WIDTH, align: 'right' });

      const metaTop = cursorY + 17;
      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted)
        .text(`Order ID: ${safe(order.id)}`, MARGIN, metaTop, { width: CONTENT_WIDTH, align: 'right' })
        .text(`Invoice No: ${safe(order.invoiceNumber || (order.id ? 'INV-' + String(order.id).replace('GDH-', '') : undefined))}`, MARGIN, metaTop + 8, { width: CONTENT_WIDTH, align: 'right' })
        .text(`Dispatch Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')}`, MARGIN, metaTop + 16, { width: CONTENT_WIDTH, align: 'right' });

      cursorY += 40;
      doc.moveTo(MARGIN, cursorY).lineTo(PAGE_WIDTH - MARGIN, cursorY).strokeColor(goldColor).lineWidth(1.2).stroke();
      cursorY += 6;

    // ================= SHIP TO / FROM — single left-aligned column =================
      const addr = order.shippingAddress || {};

      const PADDING_RIGHT = 8;                                   // 20–30pt right page padding
      const BLOCK_WIDTH = 230;                                    // fixed 220–240pt column width
      const blockX = PAGE_WIDTH - PADDING_RIGHT - BLOCK_WIDTH;    // same left edge for both sections
      const blockRight = blockX + BLOCK_WIDTH;                    // divider matches text container width exactly

      let rY = cursorY;
      const blockLine = (
        text: string,
        opts: { font?: string; size?: number; color?: string; gap?: number } = {}
      ) => {
        const { font = 'Helvetica', size = 7.5, color = textDark, gap = 9 } = opts;
        doc.font(font).fontSize(size).fillColor(color)
          .text(text, blockX, rY, { width: BLOCK_WIDTH, align: 'left' });
        rY += gap;
      };

      // ---- SHIP TO ----
      blockLine('SHIP TO', { font: 'Helvetica-Bold', size: 7.5, color: goldColor, gap: 9 });
      doc.moveTo(blockX, rY - 2).lineTo(blockRight, rY - 2).strokeColor(goldLight).lineWidth(0.75).stroke();
      rY += 3;
      blockLine(safe(addr.name), { font: 'Helvetica-Bold', size: 10, color: textDark, gap: 11 });
      blockLine(`Ph: ${safe(addr.phone)}`, { size: 7.5, gap: 9 });
      blockLine(`Email: ${safe(addr.email)}`, { size: 7.5, gap: 9 });
      blockLine(safe(addr.street), { size: 7.5, gap: 9 });
      blockLine(`${safe(addr.city)}, ${safe(addr.state)}`, { font: 'Helvetica-Bold', size: 8, color: primaryColor, gap: 9 });
      blockLine(`PIN: ${safe(addr.pincode)}`, { font: 'Helvetica-Bold', size: 9, color: primaryColor, gap: 13 });

      // ---- FROM (directly below SHIP TO, identical container) ----
      blockLine('FROM', { font: 'Helvetica-Bold', size: 7.5, color: goldColor, gap: 9 });
      doc.moveTo(blockX, rY - 2).lineTo(blockRight, rY - 2).strokeColor(goldLight).lineWidth(0.75).stroke();
      rY += 3;
      blockLine('Godhara Swadesi Products', { font: 'Helvetica-Bold', size: 9, color: textDark, gap: 11 });
      blockLine('Contact: +91 7661055143', { size: 7.5, gap: 9 });
      blockLine('Email: support@godhara.com', { size: 7.5, gap: 9 });
      blockLine('Website: www.godhara.com', { size: 7.5, gap: 9 });
      blockLine('4-3-18, Chaman Gally', { size: 7.5, gap: 9 });
      blockLine('Old Banswada', { size: 7.5, gap: 9 });
      blockLine('Kamareddy, Telangana - 503187', { size: 7.5, gap: 9 });

      cursorY = rY + 8;

      // ================= PRODUCT TABLE (capped rows, compact) =================
      const colDescX = MARGIN;
      const colQtyX = MARGIN + 190;
      const colPriceX = MARGIN + 235;
      const colAmountX = MARGIN + 305;
      const colDescW = 190;
      const colQtyW = 45;
      const colPriceW = 70;
      const colAmountW = CONTENT_WIDTH - colDescW - colQtyW - colPriceW;

      const tableHeaderHeight = 16;
      const rowHeight = 14;
      const MAX_VISIBLE_ITEMS = 7; // show up to 7 rows, then a "+X more items" summary row

      const drawTableHeader = (y: number) => {
        drawRoundedBox(MARGIN, y, CONTENT_WIDTH, tableHeaderHeight, primaryColor, undefined, 3);
        doc.font('Helvetica-Bold').fontSize(7.3).fillColor(white);
        doc.text('DESCRIPTION', colDescX + 8, y + 4.5, { width: colDescW - 8 });
        doc.text('QTY', colQtyX, y + 4.5, { width: colQtyW, align: 'center' });
        doc.text('UNIT PRICE', colPriceX, y + 4.5, { width: colPriceW, align: 'right' });
        doc.text('AMOUNT', colAmountX, y + 4.5, { width: colAmountW - 8, align: 'right' });
        return y + tableHeaderHeight;
      };

      cursorY = drawTableHeader(cursorY);

      const allItems = Array.isArray(order.items) ? order.items : [];
      const visibleItems = allItems.slice(0, MAX_VISIBLE_ITEMS);
      const hiddenCount = allItems.length - visibleItems.length;

      visibleItems.forEach((item: any, i: number) => {
        if (i % 2 === 1) {
          doc.rect(MARGIN, cursorY, CONTENT_WIDTH, rowHeight).fill(rowAltBg);
        }

        const labelText = item.packageSize ? `${item.name} (${item.packageSize})` : item.name;
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);

        doc.font('Helvetica').fontSize(7.3).fillColor(textDark);
        doc.text(safe(labelText, 'Item'), colDescX + 8, cursorY + 4, { width: colDescW - 8, height: 10 });
        doc.text(String(qty), colQtyX, cursorY + 4, { width: colQtyW, align: 'center' });
        doc.text(rupee(unitPrice), colPriceX, cursorY + 4, { width: colPriceW, align: 'right' });
        doc.text(rupee(qty * unitPrice), colAmountX, cursorY + 4, { width: colAmountW - 8, align: 'right' });

        doc.moveTo(MARGIN, cursorY + rowHeight).lineTo(PAGE_WIDTH - MARGIN, cursorY + rowHeight)
          .strokeColor(goldLight).lineWidth(0.4).stroke();

        cursorY += rowHeight;
      });

      if (hiddenCount > 0) {
        doc.rect(MARGIN, cursorY, CONTENT_WIDTH, rowHeight).fill(creamBg);
        doc.font('Helvetica-Oblique').fontSize(7).fillColor(primaryColor)
          .text(`+ ${hiddenCount} more item${hiddenCount > 1 ? 's' : ''}`, colDescX + 8, cursorY + 3.5, { width: CONTENT_WIDTH - 16 });
        doc.moveTo(MARGIN, cursorY + rowHeight).lineTo(PAGE_WIDTH - MARGIN, cursorY + rowHeight)
          .strokeColor(goldLight).lineWidth(0.4).stroke();
        cursorY += rowHeight;
      }

      cursorY += 6;

      // ================= SUMMARY (compact) =================
      const subtotal = Number(order.subtotal || 0);
      const shippingCharge = Number(order.shippingCharge || 0);
      const gstAmount = order.gstAmount !== undefined ? Number(order.gstAmount) : subtotal * 0.05;
      const grandTotal = Number(order.total !== undefined ? order.total : subtotal + shippingCharge);

      const summaryLabelW = 150;
      const summaryValW = CONTENT_WIDTH - summaryLabelW;

      doc.font('Helvetica').fontSize(7.8).fillColor(textDark);
      doc.text('Subtotal', MARGIN, cursorY, { width: summaryLabelW, align: 'right' });
      doc.text(rupee(subtotal), MARGIN + summaryLabelW, cursorY, { width: summaryValW, align: 'right' });
      cursorY += 11;

      doc.text('Shipping Charge', MARGIN, cursorY, { width: summaryLabelW, align: 'right' });
      doc.text(shippingCharge === 0 ? 'FREE' : rupee(shippingCharge), MARGIN + summaryLabelW, cursorY, { width: summaryValW, align: 'right' });
      cursorY += 11;

      doc.text('GST (5% Included)', MARGIN, cursorY, { width: summaryLabelW, align: 'right' });
      doc.text(rupee(gstAmount), MARGIN + summaryLabelW, cursorY, { width: summaryValW, align: 'right' });
      cursorY += 13;

      // Highlighted Grand Total box
      const totalBoxHeight = 20;
      drawRoundedBox(MARGIN + summaryLabelW - 90, cursorY, CONTENT_WIDTH - (summaryLabelW - 90), totalBoxHeight, primaryColor, undefined, 5);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(goldColor)
        .text('GRAND TOTAL', MARGIN + summaryLabelW - 90 + 9, cursorY + 5.5, { width: 130 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(white)
        .text(rupee(grandTotal), MARGIN + summaryLabelW, cursorY + 5, { width: summaryValW - 9, align: 'right' });
      cursorY += totalBoxHeight + 10;

      // ================= ORDER DETAILS GRID (compact) =================
      const totalWeight = allItems.reduce((acc: number, item: any) => acc + (Number(item.weight) || 250) * Number(item.qty || 0), 0);
      const totalQty = allItems.reduce((acc: number, item: any) => acc + Number(item.qty || 0), 0);
      const trackingNo = order.trackingNumber || `TRK-GDH-${String(order.id || '').slice(0, 8).toUpperCase()}`;

      const detailsBoxHeight = 50;
      drawRoundedBox(MARGIN, cursorY, CONTENT_WIDTH, detailsBoxHeight, creamBg, goldLight, 5);

      const detColLeftX = MARGIN + 10;
      const detColRightX = MARGIN + CONTENT_WIDTH / 2 + 5;
      const detColW = CONTENT_WIDTH / 2 - 20;
      let detY = cursorY + 7;
      const lineGap = 9;

      doc.font('Helvetica').fontSize(6.8).fillColor(textDark);
      doc.text(`Payment Status: ${safe(order.paymentStatus || 'PAID')}`, detColLeftX, detY, { width: detColW });
      doc.text(`Tracking No: ${trackingNo}`, detColRightX, detY, { width: detColW });
      detY += lineGap;

      doc.text(`Payment Method: ${safe(order.paymentMethod || 'Online')}`, detColLeftX, detY, { width: detColW });
      doc.text(`Weight: ${(totalWeight / 1000).toFixed(2)} kg`, detColRightX, detY, { width: detColW });
      detY += lineGap;

      doc.text(`Order Ref: ${safe(order.id)}`, detColLeftX, detY, { width: detColW });
      doc.text(`Total Qty: ${totalQty} pcs`, detColRightX, detY, { width: detColW });
      detY += lineGap;

      doc.text(`Dispatch: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')}`, detColLeftX, detY, { width: detColW });
      doc.text(`Delivery: Gaushala Cargo Logistics`, detColRightX, detY, { width: detColW });

      cursorY += detailsBoxHeight + 8;

      // ================= FOOTER — anchored to the bottom of the page =================
      // The footer's height never changes, so it's positioned from the
      // bottom of the page upward. This guarantees it always lands on
      // the same A5 sheet no matter how tall the content above is.
      const creditY = PAGE_HEIGHT - MARGIN - 8;
      const addressY = creditY - 10;
      const supportY = addressY - 10;
      const thankYouY = supportY - 13;
      const footerDividerY = thankYouY - 8;

      // ================= BARCODE — fills whatever space remains, shrinking =================
      // instead of ever pushing content to a second page.
      const barcodeIdGap = 4;
      const barcodeIdHeight = 10;
      const gapBeforeFooter = 6;
      const spaceForBarcode = footerDividerY - gapBeforeFooter - cursorY;
      const barcodeHeight = Math.max(20, Math.min(38, spaceForBarcode - barcodeIdGap - barcodeIdHeight));

      const barcodeWidth = 200;
      const barcodeX = (PAGE_WIDTH - barcodeWidth) / 2;

      try {
        const barcodeBuffer = await generateBarcodeBuffer(order.id);
        doc.image(barcodeBuffer, barcodeX, cursorY, { width: barcodeWidth, height: barcodeHeight });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark)
          .text(safe(order.id), MARGIN, cursorY + barcodeHeight + barcodeIdGap, { width: CONTENT_WIDTH, align: 'center' });
      } catch (err) {
        console.error('Failed to generate label barcode:', err);
        drawRoundedBox(barcodeX, cursorY, barcodeWidth, barcodeHeight, undefined as any, goldColor, 4);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor)
          .text(`ORDER REF: ${safe(order.id)}`, MARGIN, cursorY + barcodeHeight / 2 - 4, { width: CONTENT_WIDTH, align: 'center' });
      }

      // ================= FOOTER content (fixed bottom position) =================
      doc.moveTo(MARGIN, footerDividerY).lineTo(PAGE_WIDTH - MARGIN, footerDividerY).strokeColor(goldLight).lineWidth(0.75).stroke();

      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(primaryColor)
        .text('Thank you for shopping with Godhara \u2764', MARGIN, thankYouY, { width: CONTENT_WIDTH, align: 'center' });

      doc.font('Helvetica').fontSize(6.5).fillColor(textMuted)
        .text('Customer Support: +91 7661055143  |  support@godhara.com', MARGIN, supportY, { width: CONTENT_WIDTH, align: 'center' });

      doc.font('Helvetica').fontSize(6.2).fillColor(textMuted)
        .text('4-3-18, Chaman Gally, Old Banswada, Kamareddy, Telangana 503187', MARGIN, addressY, { width: CONTENT_WIDTH, align: 'center' });

      doc.font('Helvetica').fontSize(6).fillColor('#AAAAAA')
        .text('Powering Indian Vedic Traditions. Built by Nexkite.', MARGIN, creditY, { width: CONTENT_WIDTH, align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(destPath));
      stream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}
