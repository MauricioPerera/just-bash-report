/** Generates the self-contained HTML dashboard. */

import { type BrandTokens, brandToCssVars } from "./brand.js";
import { mdToHtml, escHtml } from "./md.js";
import { CHARTJS_SOURCE } from "./chartjs-inline.js";

export interface KpiSection {
  kind: "kpi";
  label: string;
  value: string | number;
  trend?: string;
  color?: string;
}

export interface ChartSection {
  kind: "chart";
  type: "pie" | "bar" | "line" | "doughnut";
  title: string;
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface TableSection {
  kind: "table";
  title: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface TextSection {
  kind: "text";
  content: string;
}

export type Section = KpiSection | ChartSection | TableSection | TextSection;

export interface ReportData {
  title: string;
  subtitle?: string;
  logo?: string;
  generated: string;
  sections: Section[];
  brand?: BrandTokens;
  offline?: boolean;
}

const DEFAULT_PALETTE = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
  "#84cc16", "#e11d48", "#0ea5e9", "#a855f7", "#22c55e",
];

// escHtml and mdToHtml imported from ./md.ts

function renderKpis(kpis: KpiSection[], palette: string[]): string {
  return `<div class="kpi-grid">${kpis.map((k, i) => {
    const color = k.color ?? palette[i % palette.length];
    const trendHtml = k.trend
      ? `<span class="kpi-trend ${k.trend.startsWith("+") || k.trend.startsWith("↑") ? "trend-up" : k.trend.startsWith("-") || k.trend.startsWith("↓") ? "trend-down" : ""}">${escHtml(k.trend)}</span>`
      : "";
    return `<div class="kpi-card" style="border-top:4px solid ${color}">
      <div class="kpi-value">${escHtml(String(k.value))}</div>
      <div class="kpi-label">${escHtml(k.label)}${trendHtml}</div>
    </div>`;
  }).join("")}</div>`;
}

function renderChart(chart: ChartSection, idx: number, palette: string[]): string {
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
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: chart.type === "pie" || chart.type === "doughnut", position: "bottom" },
        title: { display: false },
      },
      scales: chart.type === "bar" || chart.type === "line" ? {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false } },
      } : undefined,
    },
  });

  // Escape </ sequences to prevent closing the script tag from inside JSON
  const safeConfig = config.replace(/<\//g, "<\\/");

  return `<div class="chart-container">
    <h3 class="chart-title">${escHtml(chart.title)}</h3>
    <div class="chart-wrapper"><canvas id="${id}"></canvas></div>
    <script>new Chart(document.getElementById('${id}'),${safeConfig});</script>
  </div>`;
}

function renderTable(table: TableSection, idx: number): string {
  const tid = `table_${idx}`;
  const headerCells = table.columns.map(c => `<th onclick="sortTable('${tid}',${table.columns.indexOf(c)})">${escHtml(c)} <span class="sort-icon">↕</span></th>`).join("");

  const bodyRows = table.rows.map(row => {
    const cells = table.columns.map(col => `<td>${escHtml(String(row[col] ?? ""))}</td>`).join("");
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

function renderText(text: TextSection): string {
  return `<div class="text-section">${mdToHtml(text.content)}</div>`;
}

export function generateHtml(report: ReportData): string {
  const brand = report.brand;
  const palette = brand?.chartColors ?? DEFAULT_PALETTE;
  const cssVarOverrides = brand ? brandToCssVars(brand) : "";
  const headingFont = brand?.typography?.heading?.fontFamily;
  const bodyFont = brand?.typography?.body?.fontFamily;
  const offline = report.offline ?? false;
  const logoUrl = report.logo ?? brand?.logo;

  // Detect if we need Google Fonts
  const fontsToLoad: string[] = [];
  if (headingFont && !headingFont.includes("system") && !headingFont.includes("sans-serif")) {
    const family = headingFont.split(",")[0].trim().replace(/'/g, "");
    fontsToLoad.push(family);
  }
  if (bodyFont && !bodyFont.includes("system") && !bodyFont.includes("sans-serif")) {
    const family = bodyFont.split(",")[0].trim().replace(/'/g, "");
    if (!fontsToLoad.includes(family)) fontsToLoad.push(family);
  }
  const fontLink = fontsToLoad.length > 0
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap">`
    : "";

  const kpis = report.sections.filter((s): s is KpiSection => s.kind === "kpi");
  const others = report.sections.filter(s => s.kind !== "kpi");

  let chartIdx = 0;
  let tableIdx = 0;
  const bodySections: string[] = [];

  if (kpis.length > 0) bodySections.push(renderKpis(kpis, palette));

  for (const sec of others) {
    switch (sec.kind) {
      case "chart": bodySections.push(renderChart(sec, chartIdx++, palette)); break;
      case "table": bodySections.push(renderTable(sec, tableIdx++)); break;
      case "text": bodySections.push(renderText(sec)); break;
    }
  }

  const logoHtml = logoUrl
    ? `<img src="${escHtml(logoUrl)}" alt="Logo" class="header-logo">`
    : "";

  const fontBodyCss = bodyFont ? `font-family:var(--font-body, ${bodyFont})` : "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const fontHeadingCss = headingFont ? `font-family:var(--font-heading, ${headingFont})` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(report.title)}</title>
${offline ? "" : fontLink}
${offline ? `<script>${CHARTJS_SOURCE}</script>` : '<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>'}
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
    Generado automáticamente por just-bash-report &middot; ${escHtml(report.generated)}
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
