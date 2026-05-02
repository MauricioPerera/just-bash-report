"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createReportPlugin: () => createReportPlugin
});
module.exports = __toCommonJS(index_exports);
var import_just_bash = require("just-bash");
var import_just_bash_data = require("just-bash-data");

// src/brand.ts
var DEFAULTS = {
  colors: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    accent: "#f59e0b",
    success: "#10b981",
    danger: "#ef4444",
    background: "#f8fafc",
    card: "#ffffff",
    text: "#1e293b",
    muted: "#64748b",
    border: "#e2e8f0"
  }
};
function parseBrandFile(content) {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return { ...DEFAULTS };
  const yaml = fmMatch[1];
  const result = {};
  let currentObj = null;
  let currentKey = "";
  for (const line of yaml.split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const nestedMatch = trimmed.match(/^  (\S+):\s*(.+)$/);
    if (nestedMatch && currentObj) {
      currentObj[nestedMatch[1]] = parseValue(nestedMatch[2]);
      continue;
    }
    const kvMatch = trimmed.match(/^(\S+):\s*(.+)$/);
    if (kvMatch) {
      currentObj = null;
      const val = parseValue(kvMatch[2]);
      result[kvMatch[1]] = val;
      continue;
    }
    const objMatch = trimmed.match(/^(\S+):\s*$/);
    if (objMatch) {
      currentKey = objMatch[1];
      currentObj = {};
      result[currentKey] = currentObj;
      continue;
    }
  }
  return mergeBrand(result);
}
function parseValue(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;
  return trimmed;
}
function mergeBrand(raw) {
  const tokens = {
    colors: { ...DEFAULTS.colors }
  };
  if (raw.colors && typeof raw.colors === "object") {
    Object.assign(tokens.colors, raw.colors);
  }
  if (raw.typography && typeof raw.typography === "object") {
    tokens.typography = raw.typography;
  }
  if (typeof raw.logo === "string") tokens.logo = raw.logo;
  if (typeof raw.rounded === "string") tokens.rounded = raw.rounded;
  if (raw.chartColors && Array.isArray(raw.chartColors)) {
    tokens.chartColors = raw.chartColors;
  } else {
    tokens.chartColors = [
      tokens.colors.primary,
      tokens.colors.secondary ?? tokens.colors.primary,
      tokens.colors.accent ?? "#f59e0b",
      tokens.colors.success ?? "#10b981",
      tokens.colors.danger ?? "#ef4444",
      "#3b82f6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#06b6d4",
      "#84cc16",
      "#0ea5e9",
      "#a855f7",
      "#22c55e",
      "#e11d48"
    ];
  }
  return tokens;
}
function brandToCssVars(tokens) {
  const vars = [];
  vars.push(`--bg:${tokens.colors.background}`);
  vars.push(`--card:${tokens.colors.card}`);
  vars.push(`--text:${tokens.colors.text}`);
  vars.push(`--muted:${tokens.colors.muted}`);
  vars.push(`--border:${tokens.colors.border ?? "#e2e8f0"}`);
  vars.push(`--accent:${tokens.colors.primary}`);
  vars.push(`--success:${tokens.colors.success}`);
  vars.push(`--danger:${tokens.colors.danger}`);
  if (tokens.rounded) vars.push(`--radius:${tokens.rounded}`);
  if (tokens.typography?.heading?.fontFamily) {
    vars.push(`--font-heading:${tokens.typography.heading.fontFamily}`);
  }
  if (tokens.typography?.body?.fontFamily) {
    vars.push(`--font-body:${tokens.typography.body.fontFamily}`);
  }
  return vars.join(";");
}

// src/template.ts
var DEFAULT_PALETTE = [
  "#6366f1",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#e11d48",
  "#0ea5e9",
  "#a855f7",
  "#22c55e"
];
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function mdToHtml(md2) {
  const lines = md2.split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("### ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h3 class="sec-h3">${escHtml(trimmed.slice(4))}</h3>`;
    } else if (trimmed.startsWith("## ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h2 class="sec-h2">${escHtml(trimmed.slice(3))}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h1 class="sec-h1">${escHtml(trimmed.slice(2))}</h1>`;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${formatInline(trimmed.slice(2))}</li>`;
    } else if (trimmed === "") {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<p>${formatInline(trimmed)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}
function formatInline(s) {
  return escHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>");
}
function renderKpis(kpis, palette) {
  return `<div class="kpi-grid">${kpis.map((k, i) => {
    const color = k.color ?? palette[i % palette.length];
    const trendHtml = k.trend ? `<span class="kpi-trend ${k.trend.startsWith("+") || k.trend.startsWith("\u2191") ? "trend-up" : k.trend.startsWith("-") || k.trend.startsWith("\u2193") ? "trend-down" : ""}">${escHtml(k.trend)}</span>` : "";
    return `<div class="kpi-card" style="border-top:4px solid ${color}">
      <div class="kpi-value">${escHtml(String(k.value))}</div>
      <div class="kpi-label">${escHtml(k.label)}${trendHtml}</div>
    </div>`;
  }).join("")}</div>`;
}
function renderChart(chart, idx, palette) {
  const id = `chart_${idx}`;
  const colors = chart.colors ?? palette.slice(0, chart.labels.length);
  const config = JSON.stringify({
    type: chart.type,
    data: {
      labels: chart.labels,
      datasets: [{
        data: chart.values,
        backgroundColor: chart.type === "line" ? colors[0] + "33" : colors,
        borderColor: chart.type === "line" ? colors[0] : colors,
        borderWidth: chart.type === "line" ? 3 : 1,
        fill: chart.type === "line",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: chart.type === "pie" || chart.type === "doughnut", position: "bottom" },
        title: { display: false }
      },
      scales: chart.type === "bar" || chart.type === "line" ? {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false } }
      } : void 0
    }
  });
  return `<div class="chart-container">
    <h3 class="chart-title">${escHtml(chart.title)}</h3>
    <div class="chart-wrapper"><canvas id="${id}"></canvas></div>
    <script>new Chart(document.getElementById('${id}'),${config});</script>
  </div>`;
}
function renderTable(table) {
  const tid = `table_${Math.random().toString(36).slice(2, 8)}`;
  const headerCells = table.columns.map((c) => `<th onclick="sortTable('${tid}',${table.columns.indexOf(c)})">${escHtml(c)} <span class="sort-icon">\u2195</span></th>`).join("");
  const bodyRows = table.rows.map((row) => {
    const cells = table.columns.map((col) => `<td>${escHtml(String(row[col] ?? ""))}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<div class="table-section">
    <div class="table-header">
      <h3 class="table-title">${escHtml(table.title)}</h3>
      <input type="text" class="table-search" placeholder="Buscar..." oninput="filterTable('${tid}',this.value)">
    </div>
    <div class="table-scroll">
      <table id="${tid}">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="table-footer">${table.rows.length} registros</div>
  </div>`;
}
function renderText(text) {
  return `<div class="text-section">${mdToHtml(text.content)}</div>`;
}
function generateHtml(report) {
  const brand = report.brand;
  const palette = brand?.chartColors ?? DEFAULT_PALETTE;
  const cssVarOverrides = brand ? brandToCssVars(brand) : "";
  const headingFont = brand?.typography?.heading?.fontFamily;
  const bodyFont = brand?.typography?.body?.fontFamily;
  const logoUrl = report.logo ?? brand?.logo;
  const fontsToLoad = [];
  if (headingFont && !headingFont.includes("system") && !headingFont.includes("sans-serif")) {
    const family = headingFont.split(",")[0].trim().replace(/'/g, "");
    fontsToLoad.push(family);
  }
  if (bodyFont && !bodyFont.includes("system") && !bodyFont.includes("sans-serif")) {
    const family = bodyFont.split(",")[0].trim().replace(/'/g, "");
    if (!fontsToLoad.includes(family)) fontsToLoad.push(family);
  }
  const fontLink = fontsToLoad.length > 0 ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontsToLoad.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap">` : "";
  const kpis = report.sections.filter((s) => s.kind === "kpi");
  const others = report.sections.filter((s) => s.kind !== "kpi");
  let chartIdx = 0;
  const bodySections = [];
  if (kpis.length > 0) bodySections.push(renderKpis(kpis, palette));
  for (const sec of others) {
    switch (sec.kind) {
      case "chart":
        bodySections.push(renderChart(sec, chartIdx++, palette));
        break;
      case "table":
        bodySections.push(renderTable(sec));
        break;
      case "text":
        bodySections.push(renderText(sec));
        break;
    }
  }
  const logoHtml = logoUrl ? `<img src="${escHtml(logoUrl)}" alt="Logo" class="header-logo">` : "";
  const fontBodyCss = bodyFont ? `font-family:var(--font-body, ${bodyFont})` : "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const fontHeadingCss = headingFont ? `font-family:var(--font-heading, ${headingFont})` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(report.title)}</title>
${fontLink}
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f8fafc;--card:#fff;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--accent:#6366f1;--success:#10b981;--danger:#ef4444;--radius:12px${cssVarOverrides ? ";" + cssVarOverrides : ""}}
body{${fontBodyCss};background:var(--bg);color:var(--text);line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:24px}
.header{text-align:center;margin-bottom:32px;padding:32px 0;border-bottom:1px solid var(--border)}
.header-logo{max-height:48px;margin-bottom:12px}
.header h1{font-size:28px;font-weight:700;color:var(--text);margin-bottom:4px${fontHeadingCss ? ";" + fontHeadingCss : ""}}
.header .subtitle{font-size:16px;color:var(--muted)}
.header .date{font-size:13px;color:var(--muted);margin-top:8px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.kpi-card{background:var(--card);border-radius:var(--radius);padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.kpi-value{font-size:32px;font-weight:700;color:var(--text)}
.kpi-label{font-size:14px;color:var(--muted);margin-top:4px;display:flex;align-items:center;gap:8px}
.kpi-trend{font-size:13px;font-weight:600;padding:2px 8px;border-radius:12px;background:color-mix(in srgb,var(--success) 15%,white);color:var(--success)}
.kpi-trend.trend-down{background:color-mix(in srgb,var(--danger) 15%,white);color:var(--danger)}
.chart-container{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.chart-title{font-size:16px;font-weight:600;margin-bottom:16px}
.chart-wrapper{position:relative;height:300px}
.table-section{background:var(--card);border-radius:var(--radius);margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);overflow:hidden}
.table-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)}
.table-title{font-size:16px;font-weight:600}
.table-search{padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;outline:none;width:220px}
.table-search:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
.table-scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:12px 16px;font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap}
th:hover{color:var(--text)}
.sort-icon{font-size:11px;opacity:0.4}
td{padding:12px 16px;font-size:14px;border-bottom:1px solid var(--border)}
tr:hover td{background:#f8fafc}
.table-footer{padding:12px 20px;font-size:13px;color:var(--muted);border-top:1px solid var(--border)}
.text-section{background:var(--card);border-radius:var(--radius);padding:24px 32px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.text-section .sec-h1{font-size:22px;font-weight:700;margin:16px 0 8px}
.text-section .sec-h2{font-size:18px;font-weight:600;margin:14px 0 6px}
.text-section .sec-h3{font-size:15px;font-weight:600;margin:12px 0 4px}
.text-section p{margin:8px 0;color:#334155}
.text-section ul{margin:8px 0 8px 24px}
.text-section li{margin:4px 0}
.text-section code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px}
.text-section strong{color:var(--text)}
.footer{text-align:center;padding:24px 0;font-size:12px;color:var(--muted);border-top:1px solid var(--border);margin-top:16px}
@media print{body{background:#fff}.container{max-width:none;padding:0}.kpi-card,.chart-container,.table-section,.text-section{box-shadow:none;break-inside:avoid}}
@media(max-width:640px){.kpi-grid{grid-template-columns:1fr 1fr}.container{padding:12px}.header h1{font-size:22px}}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    ${logoHtml}
    <h1>${escHtml(report.title)}</h1>
    ${report.subtitle ? `<div class="subtitle">${escHtml(report.subtitle)}</div>` : ""}
    <div class="date">Generado: ${escHtml(report.generated)}</div>
  </div>
  ${bodySections.join("\n  ")}
  <div class="footer">
    Generado autom\xE1ticamente por just-bash-report &middot; ${escHtml(report.generated)}
  </div>
</div>
<script>
function sortTable(id,col){
  const t=document.getElementById(id),b=t.querySelector('tbody'),rows=Array.from(b.rows);
  const dir=t.dataset.sortCol==col&&t.dataset.sortDir==='asc'?'desc':'asc';
  t.dataset.sortCol=col;t.dataset.sortDir=dir;
  rows.sort((a,b)=>{
    let va=a.cells[col].textContent.trim(),vb=b.cells[col].textContent.trim();
    const na=parseFloat(va),nb=parseFloat(vb);
    if(!isNaN(na)&&!isNaN(nb))return dir==='asc'?na-nb:nb-na;
    return dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);
  });
  rows.forEach(r=>b.appendChild(r));
}
function filterTable(id,q){
  const t=document.getElementById(id),rows=t.querySelectorAll('tbody tr');
  const lq=q.toLowerCase();
  rows.forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(lq)?'':'none'});
}
</script>
</body>
</html>`;
}

// src/invoice.ts
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmt(n, currency) {
  const formatted = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency}${formatted}`;
}
function generateInvoiceHtml(inv) {
  const cur = inv.currency ?? "$";
  const taxLabel = inv.taxLabel ?? "IVA";
  const brand = inv.brand;
  const cssVars = brand ? brandToCssVars(brand) : "";
  const logoUrl = brand?.logo;
  const headingFont = brand?.typography?.heading?.fontFamily;
  const bodyFont = brand?.typography?.body?.fontFamily;
  const fontsToLoad = [];
  for (const f of [headingFont, bodyFont]) {
    if (f && !f.includes("system") && !f.includes("sans-serif")) {
      const family = f.split(",")[0].trim().replace(/'/g, "");
      if (!fontsToLoad.includes(family)) fontsToLoad.push(family);
    }
  }
  const fontLink = fontsToLoad.length > 0 ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontsToLoad.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap">` : "";
  let subtotal = 0;
  let totalTax = 0;
  const rows = inv.items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice;
    const itemTaxRate = item.tax ?? inv.taxRate ?? 0;
    const lineTax = lineTotal * itemTaxRate;
    subtotal += lineTotal;
    totalTax += lineTax;
    return { ...item, lineTotal, lineTax, taxRate: itemTaxRate };
  });
  const total = subtotal + totalTax;
  const statusColors = {
    draft: { bg: "#f1f5f9", text: "#64748b" },
    sent: { bg: "#dbeafe", text: "#1d4ed8" },
    paid: { bg: "#dcfce7", text: "#16a34a" },
    overdue: { bg: "#fee2e2", text: "#dc2626" }
  };
  const statusLabels = {
    draft: "Borrador",
    sent: "Enviada",
    paid: "Pagada",
    overdue: "Vencida"
  };
  const status = inv.status ?? "draft";
  const sc = statusColors[status] ?? statusColors.draft;
  const partyHtml = (p) => {
    const lines = [`<strong>${esc(p.name)}</strong>`];
    if (p.address) lines.push(esc(p.address));
    if (p.city) lines.push(esc(p.city));
    if (p.taxId) lines.push(`RFC: ${esc(p.taxId)}`);
    if (p.email) lines.push(esc(p.email));
    if (p.phone) lines.push(esc(p.phone));
    return lines.join("<br>");
  };
  const itemRows = rows.map((r) => `
    <tr>
      <td>${esc(r.description)}</td>
      <td class="num">${r.quantity}</td>
      <td class="num">${fmt(r.unitPrice, cur)}</td>
      <td class="num">${r.taxRate > 0 ? `${Math.round(r.taxRate * 100)}%` : "\u2014"}</td>
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
          <th>Descripci\xF3n</th>
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
    ${inv.paymentInfo ? `<div class="inv-footer-section"><div class="inv-footer-label">Informaci\xF3n de Pago</div><div class="inv-footer-text">${esc(inv.paymentInfo)}</div></div>` : ""}
    ${inv.notes ? `<div class="inv-footer-section"><div class="inv-footer-label">Notas</div><div class="inv-footer-text">${esc(inv.notes)}</div></div>` : ""}
  </div>` : ""}

  <div class="inv-watermark">Generado por just-bash-report</div>
</div>
</body>
</html>`;
}

// src/site.ts
function esc2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function md(text) {
  let html = esc2(text);
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*(<h[1-3]>)/g, "$1");
  html = html.replace(/(<\/h[1-3]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  return html;
}
function siteHead(title, brand) {
  const cssVars = brand ? brandToCssVars(brand) : "";
  const logoUrl = brand?.logo;
  const headingFont = brand?.typography?.heading?.fontFamily;
  const bodyFont = brand?.typography?.body?.fontFamily;
  const fontsToLoad = [];
  for (const f of [headingFont, bodyFont]) {
    if (f && !f.includes("system") && !f.includes("sans-serif")) {
      const family = f.split(",")[0].trim().replace(/'/g, "");
      if (!fontsToLoad.includes(family)) fontsToLoad.push(family);
    }
  }
  const fontLink = fontsToLoad.length > 0 ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontsToLoad.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap">` : "";
  const fontBody = bodyFont ?? "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const fontHead = headingFont ?? "inherit";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc2(title)}</title>
${fontLink}
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f8fafc;--card:#fff;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--accent:#6366f1;--radius:12px${cssVars ? ";" + cssVars : ""}}
body{font-family:${fontBody};background:var(--bg);color:var(--text);line-height:1.7}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.container{max-width:800px;margin:0 auto;padding:24px}
.site-header{text-align:center;padding:40px 0 32px;border-bottom:1px solid var(--border);margin-bottom:32px}
.site-logo{max-height:48px;margin-bottom:12px}
.site-title{font-size:28px;font-weight:700;font-family:${fontHead}}
.site-desc{font-size:15px;color:var(--muted);margin-top:4px}
.site-nav{margin-top:12px;display:flex;gap:16px;justify-content:center;font-size:14px}
.post-card{background:var(--card);border-radius:var(--radius);padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);transition:box-shadow 0.2s}
.post-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.1)}
.post-card h2{font-size:20px;font-family:${fontHead};margin-bottom:6px}
.post-card h2 a{color:var(--text)}
.post-meta{font-size:13px;color:var(--muted);margin-bottom:8px;display:flex;gap:12px;flex-wrap:wrap}
.post-excerpt{font-size:15px;color:#475569}
.post-tags{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.tag{font-size:12px;padding:2px 10px;border-radius:12px;background:color-mix(in srgb,var(--accent) 10%,white);color:var(--accent);font-weight:500}
.category{font-size:12px;padding:2px 10px;border-radius:12px;background:color-mix(in srgb,var(--accent) 20%,white);color:var(--accent);font-weight:600}
article{background:var(--card);border-radius:var(--radius);padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:24px}
article h1{font-size:28px;font-family:${fontHead};margin-bottom:8px}
article .post-meta{margin-bottom:24px}
article .post-body{font-size:16px}
article .post-body h1,article .post-body h2,article .post-body h3{margin:24px 0 8px;font-family:${fontHead}}
article .post-body p{margin:12px 0}
article .post-body ul{margin:12px 0 12px 24px}
article .post-body li{margin:4px 0}
article .post-body code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:14px}
.back-link{display:inline-block;margin-bottom:20px;font-size:14px}
.footer{text-align:center;padding:24px 0;font-size:12px;color:var(--muted);border-top:1px solid var(--border);margin-top:32px}
@media print{body{background:#fff}.container{max-width:none}}
@media(max-width:640px){.container{padding:12px}article{padding:20px}}
</style>
</head>`;
}
function siteHeader(config) {
  const logoHtml = config.brand?.logo ? `<img src="${esc2(config.brand.logo)}" alt="Logo" class="site-logo"><br>` : "";
  return `<div class="site-header">
  ${logoHtml}
  <div class="site-title">${esc2(config.title)}</div>
  ${config.description ? `<div class="site-desc">${esc2(config.description)}</div>` : ""}
  <nav class="site-nav">
    <a href="index.html">Inicio</a>
    <a href="rss.xml">RSS</a>
  </nav>
</div>`;
}
function generateIndex(posts, config) {
  const header = siteHeader(config);
  const postCards = posts.map((post) => {
    const slug = post.slug ?? slugify(post.Title);
    const excerpt = (post.Body ?? "").slice(0, 200).replace(/[#*`\n]/g, " ").trim();
    const tags = (post.Tags ?? []).map((t) => `<span class="tag">${esc2(t)}</span>`).join("");
    const catHtml = post.Category ? `<span class="category">${esc2(post.Category)}</span>` : "";
    return `<div class="post-card">
  <h2><a href="${slug}.html">${esc2(post.Title)}</a></h2>
  <div class="post-meta">
    ${post.Author ? `<span>Por ${esc2(post.Author)}</span>` : ""}
    ${post.PublishedAt ? `<span>${esc2(post.PublishedAt)}</span>` : ""}
    ${catHtml}
  </div>
  <div class="post-excerpt">${esc2(excerpt)}${excerpt.length >= 200 ? "..." : ""}</div>
  ${tags ? `<div class="post-tags">${tags}</div>` : ""}
</div>`;
  }).join("\n");
  return `${siteHead(config.title, config.brand)}
<body>
<div class="container">
  ${header}
  ${postCards}
  <div class="footer">${esc2(config.title)} &middot; Generado por just-bash-report</div>
</div>
</body>
</html>`;
}
function generatePostPage(post, config) {
  const tags = (post.Tags ?? []).map((t) => `<span class="tag">${esc2(t)}</span>`).join("");
  return `${siteHead(`${post.Title} \u2014 ${config.title}`, config.brand)}
<body>
<div class="container">
  ${siteHeader(config)}
  <a href="index.html" class="back-link">&larr; Volver al inicio</a>
  <article>
    <h1>${esc2(post.Title)}</h1>
    <div class="post-meta">
      ${post.Author ? `<span>Por ${esc2(post.Author)}</span>` : ""}
      ${post.PublishedAt ? `<span>${esc2(post.PublishedAt)}</span>` : ""}
      ${post.Category ? `<span class="category">${esc2(post.Category)}</span>` : ""}
    </div>
    ${tags ? `<div class="post-tags" style="margin-bottom:24px">${tags}</div>` : ""}
    <div class="post-body">${md(post.Body ?? "")}</div>
  </article>
  <div class="footer">${esc2(config.title)} &middot; Generado por just-bash-report</div>
</div>
</body>
</html>`;
}
function generateRss(posts, config) {
  const baseUrl = config.baseUrl ?? "";
  const items = posts.slice(0, 20).map((post) => {
    const slug = post.slug ?? slugify(post.Title);
    const excerpt = (post.Body ?? "").slice(0, 300).replace(/[#*`\n]/g, " ").trim();
    return `  <item>
    <title>${esc2(post.Title)}</title>
    <link>${esc2(baseUrl)}/${slug}.html</link>
    <description>${esc2(excerpt)}</description>
    ${post.PublishedAt ? `<pubDate>${new Date(post.PublishedAt).toUTCString()}</pubDate>` : ""}
    ${post.Author ? `<author>${esc2(post.Author)}</author>` : ""}
  </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc2(config.title)}</title>
  ${config.description ? `<description>${esc2(config.description)}</description>` : ""}
  <link>${esc2(baseUrl)}</link>
  <lastBuildDate>${(/* @__PURE__ */ new Date()).toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;
}

// src/index.ts
var ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
var fail = (code, msg) => ({ stdout: "", stderr: `${msg}
`, exitCode: code });
function buildReportCommand() {
  let current = null;
  return (0, import_just_bash.defineCommand)("report", async (args, ctx) => {
    const exec = (cmd) => {
      if (!ctx.exec) return Promise.resolve({ stdout: "", stderr: "ctx.exec unavailable", exitCode: 1 });
      return ctx.exec(cmd, { cwd: ctx.cwd });
    };
    const positional = [];
    const flags = /* @__PURE__ */ new Map();
    for (const a of args) {
      if (a.startsWith("--")) {
        const eq = a.indexOf("=");
        if (eq > 0) flags.set(a.slice(2, eq), a.slice(eq + 1));
        else flags.set(a.slice(2), "true");
      } else {
        positional.push(a);
      }
    }
    const sub = positional[0];
    if (!sub) return fail(2, "usage: report <create|kpi|chart|table|text|auto|render|quick|invoice|site> [...]");
    switch (sub) {
      case "create":
        return await reportCreate(positional, flags);
      case "kpi":
        return reportKpi(positional, flags);
      case "chart":
        return reportChart(positional);
      case "table":
        return reportTable(exec, positional, flags);
      case "text":
        return reportText(positional);
      case "render":
        return reportRender(ctx, flags);
      case "auto":
        return reportAuto(exec, positional, flags, ctx);
      case "quick":
        return reportQuick(exec, positional, flags, ctx);
      case "status":
        return reportStatus();
      case "invoice":
        return reportInvoice(positional, flags);
      case "site":
        return reportSite(exec, positional, flags);
      default:
        return fail(2, `unknown report command: ${sub}`);
    }
    async function reportCreate(pos, fl) {
      const title = pos.slice(1).join(" ");
      if (!title) return fail(2, "usage: report create <title> [--subtitle=...] [--brand=/path/to/BRAND.md]");
      let brand;
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          const brandContent = await ctx.fs.readFile(brandPath, "utf8");
          brand = parseBrandFile(brandContent);
        } catch {
          return fail(2, `cannot read brand file: ${brandPath}`);
        }
      }
      current = { title, subtitle: fl.get("subtitle"), sections: [], brand };
      return ok(JSON.stringify({ created: true, title, brand: !!brand }));
    }
    function reportKpi(pos, fl) {
      if (!current) return fail(2, "no report created. Run 'report create <title>' first");
      const label = pos[1];
      const value = pos[2];
      if (!label || value === void 0) return fail(2, "usage: report kpi <label> <value> [--trend=+12%] [--color=#hex]");
      const kpi = {
        kind: "kpi",
        label,
        value: isNaN(Number(value)) ? value : Number(value),
        trend: fl.get("trend"),
        color: fl.get("color")
      };
      current.sections.push(kpi);
      return ok(JSON.stringify({ added: "kpi", label }));
    }
    function reportChart(pos) {
      if (!current) return fail(2, "no report created. Run 'report create <title>' first");
      const chartType = pos[1];
      const jsonArg = pos.slice(2).join(" ");
      if (!chartType || !jsonArg) return fail(2, "usage: report chart <pie|bar|line|doughnut> '<json>' --title=...");
      let data;
      try {
        data = JSON.parse(jsonArg);
      } catch {
        return fail(2, "invalid chart json");
      }
      if (!data.labels || !data.values) return fail(2, "chart json must have 'labels' and 'values' arrays");
      const chart = {
        kind: "chart",
        type: chartType,
        title: data.title ?? chartType,
        labels: data.labels,
        values: data.values,
        colors: data.colors
      };
      current.sections.push(chart);
      return ok(JSON.stringify({ added: "chart", type: chartType, title: chart.title }));
    }
    async function reportTable(exec2, pos, fl) {
      if (!current) return fail(2, "no report created. Run 'report create <title>' first");
      const source = pos[1];
      if (!source) return fail(2, "usage: report table <collection|json> [--title=...] [--columns=col1,col2]");
      const title = fl.get("title") ?? source;
      const columnsFlag = fl.get("columns");
      const limit = fl.get("limit");
      let rows;
      let columns;
      try {
        rows = JSON.parse(source);
        if (!Array.isArray(rows)) throw new Error("not array");
      } catch {
        let cmd = `db ${source} find '{}'`;
        if (limit) cmd += ` --limit ${limit}`;
        const r = await exec2(cmd);
        if (r.exitCode !== 0) return fail(r.exitCode, `cannot read collection '${source}': ${r.stderr.trim()}`);
        rows = JSON.parse(r.stdout);
      }
      if (columnsFlag) {
        columns = columnsFlag.split(",").map((c) => c.trim());
      } else if (rows.length > 0) {
        columns = Object.keys(rows[0]).filter((k) => k !== "_id");
      } else {
        columns = [];
      }
      const table = { kind: "table", title, columns, rows };
      current.sections.push(table);
      return ok(JSON.stringify({ added: "table", title, rows: rows.length, columns: columns.length }));
    }
    function reportText(pos) {
      if (!current) return fail(2, "no report created. Run 'report create <title>' first");
      const content = pos.slice(1).join(" ");
      if (!content) return fail(2, "usage: report text '<markdown>'");
      current.sections.push({ kind: "text", content });
      return ok(JSON.stringify({ added: "text", length: content.length }));
    }
    async function reportRender(_ctx, fl) {
      if (!current) return fail(2, "no report created. Run 'report create <title>' first");
      const output = fl.get("output") ?? "/reports/report.html";
      const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
      const reportData = {
        title: current.title,
        subtitle: current.subtitle,
        generated: now,
        sections: current.sections,
        brand: current.brand,
        logo: current.brand?.logo
      };
      const html = generateHtml(reportData);
      try {
        await ctx.fs.writeFile(output, html);
      } catch {
        const dir = output.split("/").slice(0, -1).join("/");
        if (dir) {
          try {
            await ctx.fs.writeFile(dir + "/.keep", "");
          } catch {
          }
          await ctx.fs.writeFile(output, html);
        }
      }
      return ok(JSON.stringify({
        rendered: true,
        output,
        title: current.title,
        sections: current.sections.length,
        sizeBytes: html.length
      }));
    }
    async function reportAuto(exec2, pos, fl, _ctx) {
      const collection = pos[1];
      if (!collection) return fail(2, "usage: report auto <collection> [--title=...] [--output=...]");
      const title = fl.get("title") ?? `${collection} Dashboard`;
      const output = fl.get("output") ?? `/reports/${collection}.html`;
      let brand;
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          const brandContent = await ctx.fs.readFile(brandPath, "utf8");
          brand = parseBrandFile(brandContent);
        } catch {
        }
      }
      const docsR = await exec2(`db ${collection} find '{}'`);
      if (docsR.exitCode !== 0) return fail(docsR.exitCode, docsR.stderr.trim());
      const docs = JSON.parse(docsR.stdout);
      current = { title, sections: [], brand };
      current.sections.push({ kind: "kpi", label: "Total Registros", value: docs.length });
      if (docs.length > 0) {
        const sample = docs[0];
        const fields = Object.keys(sample).filter((k) => k !== "_id");
        for (const field of fields) {
          const values = docs.map((d) => d[field]).filter((v) => typeof v === "string");
          if (values.length === 0) continue;
          const unique = [...new Set(values)];
          if (unique.length >= 2 && unique.length <= 15 && unique.length < docs.length * 0.5) {
            const counts = {};
            for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
            current.sections.push({
              kind: "chart",
              type: unique.length <= 6 ? "pie" : "bar",
              title: `Por ${field}`,
              labels: Object.keys(counts),
              values: Object.values(counts)
            });
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (top) {
              current.sections.push({ kind: "kpi", label: `${field}: ${top[0]}`, value: top[1] });
            }
          }
        }
        for (const field of fields) {
          const nums = docs.map((d) => d[field]).filter((v) => typeof v === "number");
          if (nums.length < docs.length * 0.5) continue;
          const sum = nums.reduce((a, b) => a + b, 0);
          const avg = Math.round(sum / nums.length * 100) / 100;
          current.sections.push({ kind: "kpi", label: `${field} (promedio)`, value: avg });
          current.sections.push({ kind: "kpi", label: `${field} (total)`, value: sum });
        }
        for (const field of fields) {
          const dates = docs.map((d) => d[field]).filter((v) => typeof v === "string" && /^\d{4}-\d{2}/.test(v));
          if (dates.length < docs.length * 0.3) continue;
          const byMonth = {};
          for (const d of dates) {
            const month = d.slice(0, 7);
            byMonth[month] = (byMonth[month] ?? 0) + 1;
          }
          const sorted = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
          if (sorted.length >= 2) {
            current.sections.push({
              kind: "chart",
              type: "line",
              title: `${field} por mes`,
              labels: sorted.map(([k]) => k),
              values: sorted.map(([, v]) => v)
            });
          }
        }
        const columns = fields.slice(0, 8);
        current.sections.push({
          kind: "table",
          title: `Datos: ${collection}`,
          columns,
          rows: docs
        });
      }
      return reportRender(ctx, /* @__PURE__ */ new Map([["output", output]]));
    }
    async function reportQuick(_exec, pos, fl, _ctx) {
      const jsonArg = pos.slice(1).join(" ");
      if (!jsonArg) return fail(2, "usage: report quick '<json>' [--output=...]");
      let spec;
      try {
        spec = JSON.parse(jsonArg);
      } catch {
        return fail(2, "invalid json");
      }
      if (!spec.title || !spec.sections) return fail(2, "json must have 'title' and 'sections'");
      current = { title: spec.title, subtitle: spec.subtitle, sections: spec.sections };
      return reportRender(ctx, fl);
    }
    async function reportSite(exec2, pos, fl) {
      const collection = pos[1] ?? "content";
      const title = fl.get("title") ?? "Mi Sitio";
      const description = fl.get("description");
      const baseUrl = fl.get("base-url") ?? "";
      const outputDir = fl.get("output") ?? "/site";
      const statusFilter = fl.get("status") ?? "Published";
      let brand;
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          brand = parseBrandFile(await ctx.fs.readFile(brandPath, "utf8"));
        } catch {
        }
      }
      const filter = JSON.stringify({ Status: statusFilter });
      const r = await exec2(`db ${collection} find '${filter.replace(/'/g, "'\\''")}'`);
      if (r.exitCode !== 0) return fail(r.exitCode, `cannot read collection '${collection}': ${r.stderr.trim()}`);
      const posts = JSON.parse(r.stdout).sort((a, b) => (b.PublishedAt ?? b.CreatedAt ?? "").localeCompare(a.PublishedAt ?? a.CreatedAt ?? ""));
      const config = { title, description, baseUrl, brand };
      const indexHtml = generateIndex(posts, config);
      await ctx.fs.writeFile(`${outputDir}/index.html`, indexHtml);
      for (const post of posts) {
        const slug = post.slug ?? post.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const postHtml = generatePostPage(post, config);
        await ctx.fs.writeFile(`${outputDir}/${slug}.html`, postHtml);
      }
      const rss = generateRss(posts, config);
      await ctx.fs.writeFile(`${outputDir}/rss.xml`, rss);
      return ok(JSON.stringify({
        site: true,
        output: outputDir,
        pages: posts.length + 1,
        // posts + index
        posts: posts.map((p) => p.slug ?? p.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
        files: [`index.html`, ...posts.map((p) => `${p.slug ?? p.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`), `rss.xml`]
      }));
    }
    async function reportInvoice(pos, fl) {
      const jsonArg = pos.slice(1).join(" ");
      if (!jsonArg) return fail(2, "usage: report invoice '<json>' [--brand=/path] [--output=/path.html]");
      let data;
      try {
        data = JSON.parse(jsonArg);
      } catch {
        return fail(2, "invalid invoice json");
      }
      if (!data.number || !data.from || !data.to || !data.items) {
        return fail(2, "invoice json requires: number, from, to, items");
      }
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          const brandContent = await ctx.fs.readFile(brandPath, "utf8");
          data.brand = parseBrandFile(brandContent);
        } catch {
        }
      }
      const html = generateInvoiceHtml(data);
      const output = fl.get("output") ?? `/invoices/${data.number}.html`;
      try {
        await ctx.fs.writeFile(output, html);
      } catch {
        const dir = output.split("/").slice(0, -1).join("/");
        if (dir) {
          try {
            await ctx.fs.writeFile(dir + "/.keep", "");
          } catch {
          }
          await ctx.fs.writeFile(output, html);
        }
      }
      const total = data.items.reduce((s, i) => {
        const line = i.quantity * i.unitPrice;
        const tax = line * (i.tax ?? data.taxRate ?? 0);
        return s + line + tax;
      }, 0);
      return ok(JSON.stringify({
        invoice: data.number,
        output,
        total: Math.round(total * 100) / 100,
        items: data.items.length,
        sizeBytes: html.length
      }));
    }
    function reportStatus() {
      if (!current) return ok(JSON.stringify({ active: false }));
      return ok(JSON.stringify({
        active: true,
        title: current.title,
        sections: current.sections.length,
        breakdown: {
          kpis: current.sections.filter((s) => s.kind === "kpi").length,
          charts: current.sections.filter((s) => s.kind === "chart").length,
          tables: current.sections.filter((s) => s.kind === "table").length,
          texts: current.sections.filter((s) => s.kind === "text").length
        }
      }));
    }
  });
}
function createReportPlugin(opts = {}) {
  const dataPlugin = (0, import_just_bash_data.createDataPlugin)({
    rootDir: opts.rootDir ?? "/data",
    encryptionKey: opts.encryptionKey,
    authSecret: opts.authSecret,
    salt: opts.salt
  });
  return [...dataPlugin, buildReportCommand()];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createReportPlugin
});
//# sourceMappingURL=index.cjs.map