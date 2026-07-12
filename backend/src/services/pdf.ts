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
// Generate a Tax Invoice PDF
export async function generateInvoicePDF(order: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const destPath = getInvoicePath(order.id);
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(destPath);
      doc.pipe(stream);

      // Colors
      const primaryColor = '#6B2D0E'; // deep brown
      const secondaryColor = '#2C1810'; // dark brown text
      const accentColor = '#E8820C'; // saffron orange
      const tableHeaderBg = '#F5EFE6'; // cream background

      // Header Brand Group
      const logoPath = getCompanyLogoPath();
      if (logoPath) {
        doc.image(logoPath, 40, 40, { width: 50 });
      } else {
        doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('[G]', 48, 48);
      }
      doc.font('Helvetica-Bold').fontSize(22).fillColor(primaryColor).text('Godhara', 100, 42);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text('Gau Traditional Ayurvedic Products', 100, 64);
      doc.font('Helvetica').fontSize(8).fillColor('#777777').text('Pocharam Apartment, Banswada, Telangana 503187', 100, 76);

      // Invoice Title
      doc.font('Helvetica-Bold').fontSize(16).fillColor(primaryColor).text('TAX INVOICE', 430, 42, { align: 'right' });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(secondaryColor).text(`INVOICE NO: ${order.invoiceNumber || 'INV-' + order.id.replace('GDH-', '')}`, 430, 62, { align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 430, 76, { align: 'right' });

      doc.moveTo(40, 105).lineTo(555, 105).strokeColor('#D4B896').lineWidth(1).stroke();

      // Customer Info & Store Info
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor).text('BILLED TO:', 40, 115);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(secondaryColor).text(order.shippingAddress.name, 40, 127);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(order.shippingAddress.street, 40, 140);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`, 40, 152);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Phone: ${order.shippingAddress.phone || 'N/A'}`, 40, 164);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Email: ${order.shippingAddress.email || 'N/A'}`, 40, 176);

      // Payment Method Info
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor).text('PAYMENT DETAILS:', 350, 115);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Payment Status: ${order.paymentStatus || 'PAID'}`, 350, 127);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Razorpay ID: ${order.razorpayPaymentId || 'N/A'}`, 350, 140);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Payment Date: ${order.paymentDate ? new Date(order.paymentDate).toLocaleDateString() : 'N/A'}`, 350, 152);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Tracking No: ${order.trackingNumber || 'N/A'}`, 350, 164);
      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor).text(`Delivery Mode: Gaushala Cargo Logistics`, 350, 176);

      // Table Header
      const tableTop = 205;
      doc.rect(40, tableTop, 515, 20).fill(tableHeaderBg);

      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor);
      doc.text('S.No', 45, tableTop + 6, { width: 30 });
      doc.text('Description of Ayurvedic Product', 85, tableTop + 6, { width: 240 });
      doc.text('Qty', 335, tableTop + 6, { width: 30, align: 'center' });
      doc.text('Unit Price', 380, tableTop + 6, { width: 70, align: 'right' });
      doc.text('Total (INR)', 465, tableTop + 6, { width: 85, align: 'right' });

      // Clean divider line
      doc.moveTo(40, tableTop + 20).lineTo(555, tableTop + 20).strokeColor('#D4B896').lineWidth(0.5).stroke();

      // Table Items
      let currentTop = tableTop + 25;
      order.items.forEach((item: any, i: number) => {
        // Safe check for item weight/grams if present
        const labelText = item.weight ? `${item.name} (${item.weight}g)` : item.name;

        doc.font('Helvetica').fontSize(9).fillColor(secondaryColor);
        doc.text((i + 1).toString(), 45, currentTop, { width: 30 });
        doc.text(labelText, 85, currentTop, { width: 240, height: 16 });
        doc.text(item.qty.toString(), 335, currentTop, { width: 30, align: 'center' });
        doc.text(`Rs. ${item.unitPrice.toFixed(2)}`, 380, currentTop, { width: 70, align: 'right' });
        doc.text(`Rs. ${(item.qty * item.unitPrice).toFixed(2)}`, 465, currentTop, { width: 85, align: 'right' });

        currentTop += 20;
      });

      // Bottom Section Divider
      doc.moveTo(40, currentTop).lineTo(555, currentTop).strokeColor('#D4B896').lineWidth(0.5).stroke();
      currentTop += 10;

      // Totals Panel
      const totalLabelX = 350;
      const totalValX = 465;

      doc.font('Helvetica').fontSize(9).fillColor(secondaryColor);
      doc.text('Subtotal:', totalLabelX, currentTop, { width: 110, align: 'right' });
      doc.text(`Rs. ${order.subtotal.toFixed(2)}`, totalValX, currentTop, { width: 85, align: 'right' });
      currentTop += 16;

      doc.text('Shipping Charge:', totalLabelX, currentTop, { width: 110, align: 'right' });
      doc.text(order.shippingCharge === 0 ? 'FREE' : `Rs. ${order.shippingCharge.toFixed(2)}`, totalValX, currentTop, { width: 85, align: 'right' });
      currentTop += 16;

      // GST Line
      const gstAmount = order.subtotal * 0.05; // 5% GST included
      doc.text('GST (5% Included):', totalLabelX, currentTop, { width: 110, align: 'right' });
      doc.text(`Rs. ${gstAmount.toFixed(2)}`, totalValX, currentTop, { width: 85, align: 'right' });
      currentTop += 20;

      // Grand Total Ring
      doc.rect(340, currentTop - 2, 215, 20).fill(tableHeaderBg);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
      doc.text('GRAND TOTAL:', totalLabelX, currentTop + 3, { width: 110, align: 'right' });
      doc.text(`Rs. ${order.total.toFixed(2)}`, totalValX, currentTop + 3, { width: 85, align: 'right' });

      // Traditional Seal Note and Thank You Footer
      currentTop += 65;
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(primaryColor).text('Thank you for shopping with Godhara!', 40, currentTop, { align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#777777').text('Every purchase supports Gaushalas & sustainable organic Indian farming loops.', 40, currentTop + 14, { align: 'center' });

      // Elegant tiny footer credit
      doc.font('Helvetica').fontSize(7).fillColor('#AAAAAA').text('Powering Indian Vedic Traditions. Built by Nexkite.', 40, doc.page.height - 30, { align: 'center' });

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

      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
        margin: MARGIN,
        bufferPages: true,
      });

      const stream = fs.createWriteStream(destPath);
      doc.pipe(stream);

      // ---------- Theme: Brown + Gold, Modern Luxury ----------
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

      const safe = (val: any, fallback = 'N/A') =>
        val === undefined || val === null || val === '' ? fallback : val;

      let cursorY = MARGIN;

      // ================= HEADER =================
      const logoPath = getCompanyLogoPath();
      if (logoPath) {
        doc.image(logoPath, MARGIN, cursorY, { width: 38 });
      } else {
        drawRoundedBox(MARGIN, cursorY, 38, 38, creamBg, goldLight, 6);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('G', MARGIN, cursorY + 11, { width: 38, align: 'center' });
      }

      doc.font('Helvetica-Bold').fontSize(15).fillColor(primaryColor)
        .text('GODHARA', MARGIN + 46, cursorY + 2);
      doc.font('Helvetica').fontSize(7.5).fillColor(goldColor)
        .text('Swadesi Products', MARGIN + 46, cursorY + 20);

      // Right side title
      doc.font('Helvetica-Bold').fontSize(15).fillColor(primaryColor)
        .text('SHIPPING LABEL', MARGIN, cursorY + 1, { width: CONTENT_WIDTH, align: 'right' });

      const metaTop = cursorY + 20;
      doc.font('Helvetica').fontSize(7.2).fillColor(textMuted)
        .text(`Order ID: ${safe(order.id)}`, MARGIN, metaTop, { width: CONTENT_WIDTH, align: 'right' })
        .text(`Invoice No: ${safe(order.invoiceNumber || (order.id ? 'INV-' + String(order.id).replace('GDH-', '') : undefined))}`, MARGIN, metaTop + 9, { width: CONTENT_WIDTH, align: 'right' })
        .text(`Dispatch Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')}`, MARGIN, metaTop + 18, { width: CONTENT_WIDTH, align: 'right' });

      cursorY += 46;
      doc.moveTo(MARGIN, cursorY).lineTo(PAGE_WIDTH - MARGIN, cursorY).strokeColor(goldColor).lineWidth(1.4).stroke();
      cursorY += 10;

      // ================= TO / FROM BOXES =================
      const boxGap = 8;
      const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
      const boxHeight = 106;
      const toX = MARGIN;
      const fromX = MARGIN + boxWidth + boxGap;

      drawRoundedBox(toX, cursorY, boxWidth, boxHeight, creamBg, goldLight, 8);
      drawRoundedBox(fromX, cursorY, boxWidth, boxHeight, creamBg, goldLight, 8);

      const addr = order.shippingAddress || {};
      let toY = cursorY + 10;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(goldColor).text('SHIP TO', toX + 10, toY);
      toY += 12;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(textDark).text(safe(addr.name), toX + 10, toY, { width: boxWidth - 20 });
      toY += 14;
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text(`Ph: ${safe(addr.phone)}`, toX + 10, toY, { width: boxWidth - 20 });
      toY += 11;
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text(`Email: ${safe(addr.email)}`, toX + 10, toY, { width: boxWidth - 20 });
      toY += 11;
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text(safe(addr.street), toX + 10, toY, { width: boxWidth - 20, height: 24 });
      toY += 22;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryColor).text(`${safe(addr.city)}, ${safe(addr.state)}`, toX + 10, toY, { width: boxWidth - 20 });
      toY += 11;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text(`PIN: ${safe(addr.pincode)}`, toX + 10, toY, { width: boxWidth - 20 });

      let fromY = cursorY + 10;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(goldColor).text('FROM', fromX + 10, fromY);
      fromY += 12;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark).text('Godhara Swadesi Products', fromX + 10, fromY, { width: boxWidth - 20 });
      fromY += 14;
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text('Contact: +91 7661055143', fromX + 10, fromY, { width: boxWidth - 20 });
      fromY += 11;
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text('Email: support@godhara.com', fromX + 10, fromY, { width: boxWidth - 20 });
      fromY += 11;
      doc.font('Helvetica').fontSize(8).fillColor(textDark).text('Website: www.godhara.com', fromX + 10, fromY, { width: boxWidth - 20 });
      fromY += 11;
      doc.font('Helvetica').fontSize(7.5).fillColor(textDark).text(
        '4-3-18, Chaman Gally, Old Banswada, Kamareddy, Telangana - 503187',
        fromX + 10, fromY, { width: boxWidth - 20, height: 26 }
      );

      cursorY += boxHeight + 14;

      // ================= PRODUCT TABLE =================
      const colDescX = MARGIN;
      const colQtyX = MARGIN + 190;
      const colPriceX = MARGIN + 235;
      const colAmountX = MARGIN + 305;
      const colDescW = 190;
      const colQtyW = 45;
      const colPriceW = 70;
      const colAmountW = CONTENT_WIDTH - colDescW - colQtyW - colPriceW;

      const tableHeaderHeight = 20;
      const rowHeight = 18;
      const footerReserveHeight = 210; // space reserved for summary + order details + barcode + footer

      const drawTableHeader = (y: number) => {
        drawRoundedBox(MARGIN, y, CONTENT_WIDTH, tableHeaderHeight, primaryColor, undefined, 4);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(white);
        doc.text('DESCRIPTION', colDescX + 8, y + 6, { width: colDescW - 8 });
        doc.text('QTY', colQtyX, y + 6, { width: colQtyW, align: 'center' });
        doc.text('UNIT PRICE', colPriceX, y + 6, { width: colPriceW, align: 'right' });
        doc.text('AMOUNT', colAmountX, y + 6, { width: colAmountW - 8, align: 'right' });
        return y + tableHeaderHeight;
      };

      cursorY = drawTableHeader(cursorY);

      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item: any, i: number) => {
        // Page-break guard: start a fresh table if running out of room
        if (cursorY + rowHeight > PAGE_HEIGHT - footerReserveHeight) {
          doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: MARGIN });
          cursorY = MARGIN;
          cursorY = drawTableHeader(cursorY);
        }

        if (i % 2 === 1) {
          doc.rect(MARGIN, cursorY, CONTENT_WIDTH, rowHeight).fill(rowAltBg);
        }

        const labelText = item.weight ? `${item.name} (${item.weight}g)` : item.name;
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);

        doc.font('Helvetica').fontSize(8).fillColor(textDark);
        doc.text(safe(labelText, 'Item'), colDescX + 8, cursorY + 5, { width: colDescW - 8, height: 12 });
        doc.text(String(qty), colQtyX, cursorY + 5, { width: colQtyW, align: 'center' });
        doc.text(rupee(unitPrice), colPriceX, cursorY + 5, { width: colPriceW, align: 'right' });
        doc.text(rupee(qty * unitPrice), colAmountX, cursorY + 5, { width: colAmountW - 8, align: 'right' });

        doc.moveTo(MARGIN, cursorY + rowHeight).lineTo(PAGE_WIDTH - MARGIN, cursorY + rowHeight)
          .strokeColor(goldLight).lineWidth(0.4).stroke();

        cursorY += rowHeight;
      });

      cursorY += 10;

      // If summary won't fit, push to a new page
      if (cursorY + footerReserveHeight - 20 > PAGE_HEIGHT) {
        doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: MARGIN });
        cursorY = MARGIN;
      }

      // ================= SUMMARY =================
      const subtotal = Number(order.subtotal || 0);
      const shippingCharge = Number(order.shippingCharge || 0);
      const gstAmount = order.gstAmount !== undefined ? Number(order.gstAmount) : subtotal * 0.05;
      const grandTotal = Number(order.total !== undefined ? order.total : subtotal + shippingCharge);

      const summaryLabelW = 150;
      const summaryValW = CONTENT_WIDTH - summaryLabelW;

      doc.font('Helvetica').fontSize(8.5).fillColor(textDark);
      doc.text('Subtotal', MARGIN, cursorY, { width: summaryLabelW, align: 'right' });
      doc.text(rupee(subtotal), MARGIN + summaryLabelW, cursorY, { width: summaryValW, align: 'right' });
      cursorY += 14;

      doc.text('Shipping Charge', MARGIN, cursorY, { width: summaryLabelW, align: 'right' });
      doc.text(shippingCharge === 0 ? 'FREE' : rupee(shippingCharge), MARGIN + summaryLabelW, cursorY, { width: summaryValW, align: 'right' });
      cursorY += 14;

      doc.text('GST (5% Included)', MARGIN, cursorY, { width: summaryLabelW, align: 'right' });
      doc.text(rupee(gstAmount), MARGIN + summaryLabelW, cursorY, { width: summaryValW, align: 'right' });
      cursorY += 16;

      // Highlighted Grand Total box
      const totalBoxHeight = 24;
      drawRoundedBox(MARGIN + summaryLabelW - 90, cursorY, CONTENT_WIDTH - (summaryLabelW - 90), totalBoxHeight, primaryColor, undefined, 6);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(goldColor)
        .text('GRAND TOTAL', MARGIN + summaryLabelW - 90 + 10, cursorY + 7, { width: 130 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(white)
        .text(rupee(grandTotal), MARGIN + summaryLabelW, cursorY + 6, { width: summaryValW - 10, align: 'right' });
      cursorY += totalBoxHeight + 14;

      // ================= ORDER DETAILS GRID =================
      const totalWeight = items.reduce((acc: number, item: any) => acc + (Number(item.weight) || 250) * Number(item.qty || 0), 0);
      const totalQty = items.reduce((acc: number, item: any) => acc + Number(item.qty || 0), 0);
      const trackingNo = order.trackingNumber || `TRK-GDH-${String(order.id || '').slice(0, 8).toUpperCase()}`;

      const detailsBoxHeight = 66;
      drawRoundedBox(MARGIN, cursorY, CONTENT_WIDTH, detailsBoxHeight, creamBg, goldLight, 6);

      const detColLeftX = MARGIN + 10;
      const detColRightX = MARGIN + CONTENT_WIDTH / 2 + 5;
      const detColW = CONTENT_WIDTH / 2 - 20;
      let detY = cursorY + 9;
      const lineGap = 11;

      doc.font('Helvetica').fontSize(7.6).fillColor(textDark);
      doc.text(`Payment Status: ${safe(order.paymentStatus || 'PAID')}`, detColLeftX, detY, { width: detColW });
      doc.text(`Tracking Number: ${trackingNo}`, detColRightX, detY, { width: detColW });
      detY += lineGap;

      doc.text(`Payment Method: ${safe(order.paymentMethod || 'Online')}`, detColLeftX, detY, { width: detColW });
      doc.text(`Weight: ${(totalWeight / 1000).toFixed(2)} kg`, detColRightX, detY, { width: detColW });
      detY += lineGap;

      doc.text(`Order Reference: ${safe(order.id)}`, detColLeftX, detY, { width: detColW });
      doc.text(`Total Quantity: ${totalQty} pcs`, detColRightX, detY, { width: detColW });
      detY += lineGap;

      doc.text(`Dispatch Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN')}`, detColLeftX, detY, { width: detColW });
      doc.text(`Delivery Mode: Gaushala Cargo Logistics`, detColRightX, detY, { width: detColW });

      cursorY += detailsBoxHeight + 14;

      // ================= BARCODE =================
      if (cursorY + 90 > PAGE_HEIGHT - MARGIN) {
        doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: MARGIN });
        cursorY = MARGIN;
      }

      const barcodeWidth = 220;
      const barcodeX = (PAGE_WIDTH - barcodeWidth) / 2;

      try {
        const barcodeBuffer = await generateBarcodeBuffer(order.id);
        doc.image(barcodeBuffer, barcodeX, cursorY, { width: barcodeWidth, height: 44 });
        cursorY += 48;
        doc.font('Helvetica-Bold').fontSize(9).fillColor(textDark)
          .text(safe(order.id), MARGIN, cursorY, { width: CONTENT_WIDTH, align: 'center' });
        cursorY += 16;
      } catch (err) {
        console.error('Failed to generate label barcode:', err);
        drawRoundedBox(barcodeX, cursorY, barcodeWidth, 44, undefined as any, goldColor, 4);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor)
          .text(`ORDER REF: ${safe(order.id)}`, MARGIN, cursorY + 16, { width: CONTENT_WIDTH, align: 'center' });
        cursorY += 60;
      }

      // ================= FOOTER =================
      doc.moveTo(MARGIN, cursorY).lineTo(PAGE_WIDTH - MARGIN, cursorY).strokeColor(goldLight).lineWidth(0.75).stroke();
      cursorY += 10;

      doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(primaryColor)
        .text('Thank you for shopping with Godhara \u2764', MARGIN, cursorY, { width: CONTENT_WIDTH, align: 'center' });
      cursorY += 14;

      doc.font('Helvetica').fontSize(7).fillColor(textMuted)
        .text('Customer Support: +91 7661055143  |  support@godhara.com  |  www.godhara.com', MARGIN, cursorY, { width: CONTENT_WIDTH, align: 'center' });
      cursorY += 10;

      doc.font('Helvetica').fontSize(6.8).fillColor(textMuted)
        .text('4-3-18, Chaman Gally, Old Banswada, Kamareddy, Telangana 503187', MARGIN, cursorY, { width: CONTENT_WIDTH, align: 'center' });

      doc.font('Helvetica').fontSize(6.2).fillColor('#AAAAAA')
        .text('Powering Indian Vedic Traditions. Built by Nexkite.', MARGIN, PAGE_HEIGHT - MARGIN - 8, { width: CONTENT_WIDTH, align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(destPath));
      stream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}
