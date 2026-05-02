/**
 * Invoice HTML generator.
 * Self-contained HTML, print-ready, uses BRAND.md tokens.
 */

import { type BrandTokens, brandToCssVars } from "./brand.js";

export interface InvoiceParty {
  name: string;
  address?: string;
  city?: string;
  taxId?: string;
  email?: string;
  phone?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  tax?: number;       // tax rate 0-1 (e.g. 0.16 for 16%)
}

export interface InvoiceData {
  number: string;
  date: string;
  dueDate?: string;
  from: InvoiceParty;
  to: InvoiceParty;
  items: InvoiceItem[];
  currency?: string;  // default: "$"
  taxLabel?: string;  // default: "IVA"
  taxRate?: number;    // global tax rate if not per-item (0-1)
  notes?: string;
  paymentInfo?: string;
  status?: "draft" | "sent" | "paid" | "overdue";
  brand?: BrandTokens;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number, currency: string): string {
  const formatted = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency}${formatted}`;
}

export function generateInvoiceHtml(inv: InvoiceData): string {
  const cur = inv.currency ?? "$";
  const taxLabel = inv.taxLabel ?? "IVA";
  const brand = inv.brand;
  const cssVars = brand ? brandToCssVars(brand) : "";
  const logoUrl = brand?.logo;
  const headingFont = brand?.typography?.heading?.fontFamily;
  const bodyFont = brand?.typography?.body?.fontFamily;

  // Fonts
  const fontsToLoad: string[] = [];
  for (const f of [headingFont, bodyFont]) {
    if (f && !f.includes("system") && !f.includes("sans-serif")) {
      const family = f.split(",")[0].trim().replace(/'/g, "");
      if (!fontsToLoad.includes(family)) fontsToLoad.push(family);
    }
  }
  const fontLink = fontsToLoad.length > 0
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap">`
    : "";

  // Calculate totals
  let subtotal = 0;
  let totalTax = 0;
  const rows = inv.items.map(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const itemTaxRate = item.tax ?? inv.taxRate ?? 0;
    const lineTax = lineTotal * itemTaxRate;
    subtotal += lineTotal;
    totalTax += lineTax;
    return { ...item, lineTotal, lineTax, taxRate: itemTaxRate };
  });
  const total = subtotal + totalTax;

  // Status badge
  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: "#f1f5f9", text: "#64748b" },
    sent: { bg: "#dbeafe", text: "#1d4ed8" },
    paid: { bg: "#dcfce7", text: "#16a34a" },
    overdue: { bg: "#fee2e2", text: "#dc2626" },
  };
  const statusLabels: Record<string, string> = {
    draft: "Borrador", sent: "Enviada", paid: "Pagada", overdue: "Vencida",
  };
  const status = inv.status ?? "draft";
  const sc = statusColors[status] ?? statusColors.draft;

  const partyHtml = (p: InvoiceParty) => {
    const lines = [`<strong>${esc(p.name)}</strong>`];
    if (p.address) lines.push(esc(p.address));
    if (p.city) lines.push(esc(p.city));
    if (p.taxId) lines.push(`RFC: ${esc(p.taxId)}`);
    if (p.email) lines.push(esc(p.email));
    if (p.phone) lines.push(esc(p.phone));
    return lines.join("<br>");
  };

  const itemRows = rows.map(r => `
    <tr>
      <td>${esc(r.description)}</td>
      <td class="num">${r.quantity}</td>
      <td class="num">${fmt(r.unitPrice, cur)}</td>
      <td class="num">${r.taxRate > 0 ? `${Math.round(r.taxRate * 100)}%` : "—"}</td>
      <td class="num">${fmt(r.lineTotal, cur)}</td>
    </tr>`).join("");

  const fontBodyCss = bodyFont ? `font-family:${bodyFont}` : "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const fontHeadCss = headingFont ? `font-family:${headingFont}` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Factura ${esc(inv.number)}</title>
${fontLink}
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#fff;--card:#fff;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--accent:#6366f1;--radius:8px${cssVars ? ";" + cssVars : ""}}
body{${fontBodyCss};color:var(--text);line-height:1.6;background:#f8fafc}
.invoice{max-width:800px;margin:24px auto;background:var(--card);border-radius:var(--radius);box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden}
.inv-header{display:flex;justify-content:space-between;align-items:flex-start;padding:40px 40px 24px;border-bottom:3px solid var(--accent)}
.inv-logo{max-height:56px}
.inv-title-block{text-align:right}
.inv-title{font-size:32px;font-weight:700;color:var(--accent);letter-spacing:-0.5px${fontHeadCss ? ";" + fontHeadCss : ""}}
.inv-number{font-size:14px;color:var(--muted);margin-top:4px}
.inv-status{display:inline-block;padding:3px 12px;border-radius:12px;font-size:12px;font-weight:600;margin-top:8px;background:${sc.bg};color:${sc.text}}
.inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:24px 40px}
.inv-party-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600;margin-bottom:6px}
.inv-party{font-size:14px;line-height:1.7}
.inv-meta{padding:0 40px 16px;display:flex;gap:32px}
.inv-meta-item{font-size:13px;color:var(--muted)}
.inv-meta-item strong{color:var(--text)}
.inv-table{padding:0 40px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);border-bottom:2px solid var(--border);background:#f8fafc}
td{padding:10px 12px;font-size:14px;border-bottom:1px solid var(--border)}
.num{text-align:right;font-variant-numeric:tabular-nums}
th.num{text-align:right}
.inv-totals{padding:16px 40px 24px;display:flex;justify-content:flex-end}
.inv-totals-table{width:280px}
.inv-totals-table tr td{padding:6px 0;font-size:14px;border:none}
.inv-totals-table tr td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.inv-totals-table .total-row td{font-size:18px;font-weight:700;color:var(--accent);border-top:2px solid var(--accent);padding-top:10px}
.inv-footer{padding:20px 40px 32px;border-top:1px solid var(--border)}
.inv-footer-section{margin-bottom:12px}
.inv-footer-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600;margin-bottom:4px}
.inv-footer-text{font-size:13px;color:#475569;white-space:pre-line}
.inv-watermark{text-align:center;padding:12px;font-size:11px;color:var(--muted)}
@media print{
  body{background:#fff}
  .invoice{box-shadow:none;margin:0;max-width:none}
  .inv-watermark{display:none}
}
@media(max-width:640px){
  .inv-header{flex-direction:column;gap:16px;padding:24px}
  .inv-title-block{text-align:left}
  .inv-parties{grid-template-columns:1fr;padding:16px 24px}
  .inv-table,.inv-totals,.inv-footer,.inv-meta{padding-left:24px;padding-right:24px}
}
</style>
</head>
<body>
<div class="invoice">
  <div class="inv-header">
    <div>${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" class="inv-logo">` : `<div style="font-size:20px;font-weight:700${fontHeadCss ? ";" + fontHeadCss : ""}">${esc(inv.from.name)}</div>`}</div>
    <div class="inv-title-block">
      <div class="inv-title">FACTURA</div>
      <div class="inv-number">${esc(inv.number)}</div>
      <div class="inv-status">${statusLabels[status] ?? status}</div>
    </div>
  </div>

  <div class="inv-parties">
    <div>
      <div class="inv-party-label">De</div>
      <div class="inv-party">${partyHtml(inv.from)}</div>
    </div>
    <div>
      <div class="inv-party-label">Para</div>
      <div class="inv-party">${partyHtml(inv.to)}</div>
    </div>
  </div>

  <div class="inv-meta">
    <div class="inv-meta-item"><strong>Fecha:</strong> ${esc(inv.date)}</div>
    ${inv.dueDate ? `<div class="inv-meta-item"><strong>Vencimiento:</strong> ${esc(inv.dueDate)}</div>` : ""}
  </div>

  <div class="inv-table">
    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th class="num">Cant.</th>
          <th class="num">Precio Unit.</th>
          <th class="num">${esc(taxLabel)}</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </div>

  <div class="inv-totals">
    <table class="inv-totals-table">
      <tr><td>Subtotal</td><td>${fmt(subtotal, cur)}</td></tr>
      ${totalTax > 0 ? `<tr><td>${esc(taxLabel)}</td><td>${fmt(totalTax, cur)}</td></tr>` : ""}
      <tr class="total-row"><td>Total</td><td>${fmt(total, cur)}</td></tr>
    </table>
  </div>

  ${inv.notes || inv.paymentInfo ? `<div class="inv-footer">
    ${inv.paymentInfo ? `<div class="inv-footer-section"><div class="inv-footer-label">Información de Pago</div><div class="inv-footer-text">${esc(inv.paymentInfo)}</div></div>` : ""}
    ${inv.notes ? `<div class="inv-footer-section"><div class="inv-footer-label">Notas</div><div class="inv-footer-text">${esc(inv.notes)}</div></div>` : ""}
  </div>` : ""}

  <div class="inv-watermark">Generado por just-bash-report</div>
</div>
</body>
</html>`;
}
