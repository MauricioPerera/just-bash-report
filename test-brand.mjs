/**
 * Test: branded report with BRAND.md theming.
 * Simulates a finance team at "NovaCorp" generating a branded Q1 report.
 */

import { Bash, InMemoryFs } from "just-bash";
import { createReportPlugin } from "./dist/index.js";
import { writeFileSync } from "fs";

// ── Brand file content ────────────────────────────────────
const BRAND_MD = `---
colors:
  primary: "#0f172a"
  secondary: "#1e40af"
  accent: "#f59e0b"
  success: "#059669"
  danger: "#dc2626"
  background: "#f1f5f9"
  card: "#ffffff"
  text: "#0f172a"
  muted: "#475569"
  border: "#cbd5e1"

typography:
  heading:
    fontFamily: "Playfair Display, serif"
    fontWeight: 700
  body:
    fontFamily: "Inter, sans-serif"
    fontWeight: 400

logo: "https://img.logoipsum.com/245.svg"
rounded: "16px"
---

# NovaCorp — Brand Identity

Dark navy primary with royal blue secondary.
Amber accent for highlights and CTAs.
Playfair Display for headings, Inter for body.
`;

const bash = new Bash({
  fs: new InMemoryFs({
    "/brand/BRAND.md": BRAND_MD,
  }),
  customCommands: createReportPlugin({ rootDir: "/data" }),
});

const run = async (cmd) => {
  const r = await bash.exec(cmd);
  if (r.exitCode !== 0) console.log(`  ERR [${r.exitCode}]: ${r.stderr.trim()}`);
  return r;
};

async function main() {
  console.log("=== NovaCorp Q1 Finance Report (Branded) ===\n");

  // 1. Seed financial data
  const transactions = [
    { month: "Enero", category: "Ventas", amount: 125000, type: "ingreso" },
    { month: "Enero", category: "Marketing", amount: -18000, type: "gasto" },
    { month: "Enero", category: "Nómina", amount: -65000, type: "gasto" },
    { month: "Enero", category: "Servicios", amount: 45000, type: "ingreso" },
    { month: "Febrero", category: "Ventas", amount: 138000, type: "ingreso" },
    { month: "Febrero", category: "Marketing", amount: -22000, type: "gasto" },
    { month: "Febrero", category: "Nómina", amount: -65000, type: "gasto" },
    { month: "Febrero", category: "Servicios", amount: 52000, type: "ingreso" },
    { month: "Marzo", category: "Ventas", amount: 156000, type: "ingreso" },
    { month: "Marzo", category: "Marketing", amount: -15000, type: "gasto" },
    { month: "Marzo", category: "Nómina", amount: -68000, type: "gasto" },
    { month: "Marzo", category: "Servicios", amount: 48000, type: "ingreso" },
    { month: "Marzo", category: "Licencias", amount: 32000, type: "ingreso" },
  ];

  for (const t of transactions) {
    await run(`db transactions insert '${JSON.stringify(t)}'`);
  }

  // 2. Calculate metrics
  const income = transactions.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const expenses = Math.abs(transactions.filter(t => t.type === "gasto").reduce((s, t) => s + t.amount, 0));
  const net = income - expenses;
  const margin = Math.round(net / income * 100);

  // Monthly breakdown
  const months = ["Enero", "Febrero", "Marzo"];
  const monthlyIncome = months.map(m => transactions.filter(t => t.month === m && t.type === "ingreso").reduce((s, t) => s + t.amount, 0));
  const monthlyExpenses = months.map(m => Math.abs(transactions.filter(t => t.month === m && t.type === "gasto").reduce((s, t) => s + t.amount, 0)));

  // By category
  const categories = {};
  transactions.forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount);
  });

  // 3. Build branded report
  await run(`report create "Reporte Financiero Q1 2026" --subtitle="NovaCorp S.A. de C.V." --brand=/brand/BRAND.md`);

  // KPIs
  await run(`report kpi "Ingresos Totales" "$${income.toLocaleString()}" --trend=+${Math.round((monthlyIncome[2] - monthlyIncome[0]) / monthlyIncome[0] * 100)}%`);
  await run(`report kpi "Gastos Totales" "$${expenses.toLocaleString()}" --trend=+${Math.round((monthlyExpenses[2] - monthlyExpenses[0]) / monthlyExpenses[0] * 100)}%`);
  await run(`report kpi "Utilidad Neta" "$${net.toLocaleString()}" --trend=+${margin}% margen`);
  await run(`report kpi "Margen de Utilidad" "${margin}%" --color=#059669`);
  await run(`report kpi "Transacciones" ${transactions.length}`);
  await run(`report kpi "Categorías" ${Object.keys(categories).length}`);

  // Charts
  await run(`report chart bar '${JSON.stringify({
    title: "Ingresos vs Gastos por Mes",
    labels: months,
    values: monthlyIncome,
  })}'`);

  await run(`report chart line '${JSON.stringify({
    title: "Tendencia de Gastos Mensuales",
    labels: months,
    values: monthlyExpenses,
  })}'`);

  await run(`report chart doughnut '${JSON.stringify({
    title: "Distribución por Categoría",
    labels: Object.keys(categories),
    values: Object.values(categories),
  })}'`);

  // Analysis
  await run(`report text "## Resumen Ejecutivo

El primer trimestre de 2026 muestra un crecimiento sostenido con **$${income.toLocaleString()}** en ingresos totales y un margen de utilidad del **${margin}%**.

### Highlights
- **Ventas** creció un ${Math.round((156000 - 125000) / 125000 * 100)}% de enero a marzo
- **Marketing** se redujo un ${Math.round((22000 - 15000) / 22000 * 100)}% en gasto, señal de mayor eficiencia
- **Licencias** generó $32,000 adicionales en marzo — nuevo canal de ingresos

### Riesgos
- La nómina creció un ${Math.round((68000 - 65000) / 65000 * 100)}% — monitorear headcount vs productividad
- Concentración: Ventas representa el ${Math.round(transactions.filter(t => t.category === 'Ventas').reduce((s, t) => s + t.amount, 0) / income * 100)}% de los ingresos

### Recomendaciones
- Escalar el canal de Licencias (potencial $100K+ anual)
- Mantener el gasto de Marketing por debajo del 5% de ingresos
- Planificar revisión salarial Q2 con base en performance"`);

  // Table
  await run(`report table transactions --title="Detalle de Transacciones" --columns=month,category,type,amount`);

  // Render
  const renderR = await run(`report render --output=/reports/novacorp-q1.html`);
  console.log("Render:", renderR.stdout);

  // Save to disk
  const html = await bash.readFile("/reports/novacorp-q1.html");
  const outPath = "/home/mauricioperera/Escritorio/just-bash-report/demo-branded.html";
  writeFileSync(outPath, html);
  console.log(`\nSaved: ${outPath}`);

  // Also generate a non-branded version for comparison
  await run(`report create "Reporte Financiero Q1 2026" --subtitle="Sin marca"`);
  await run(`report kpi "Ingresos" "$${income.toLocaleString()}"`);
  await run(`report kpi "Gastos" "$${expenses.toLocaleString()}"`);
  await run(`report kpi "Utilidad" "$${net.toLocaleString()}"`);
  await run(`report chart pie '${JSON.stringify({ title: "Por Categoría", labels: Object.keys(categories), values: Object.values(categories) })}'`);
  await run(`report table transactions --title="Transacciones"`);
  await run(`report render --output=/reports/no-brand.html`);
  const html2 = await bash.readFile("/reports/no-brand.html");
  writeFileSync("/home/mauricioperera/Escritorio/just-bash-report/demo-no-brand.html", html2);
  console.log("Saved: demo-no-brand.html (for comparison)");
}

main().catch(console.error);
