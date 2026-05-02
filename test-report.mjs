/**
 * Test: HR department generates monthly report via LLM agent.
 * The agent populates data and builds the report — HR just opens the HTML.
 */

import { Bash, InMemoryFs } from "just-bash";
import { createReportPlugin } from "./dist/index.js";
import { writeFileSync } from "fs";

const bash = new Bash({
  fs: new InMemoryFs({}),
  customCommands: createReportPlugin({ rootDir: "/data" }),
});

const run = async (cmd) => {
  const r = await bash.exec(cmd);
  if (r.exitCode !== 0) console.log(`  ERR [${r.exitCode}]: ${r.stderr.trim()} — ${cmd.slice(0, 80)}`);
  return r;
};

async function main() {
  console.log("=== Simulating: LLM agent prepares HR monthly report ===\n");

  // ── 1. Agent populates employee data ────────────────────
  console.log("1. Populating employee data...");
  const employees = [
    { name: "Ana García", department: "Ventas", position: "Account Executive", hire_date: "2024-03-15", salary: 45000, status: "Activo" },
    { name: "Carlos López", department: "Tecnología", position: "Senior Developer", hire_date: "2023-01-10", salary: 62000, status: "Activo" },
    { name: "María Rodríguez", department: "RRHH", position: "HR Manager", hire_date: "2022-06-01", salary: 55000, status: "Activo" },
    { name: "Juan Martínez", department: "Ventas", position: "Sales Director", hire_date: "2021-09-20", salary: 78000, status: "Activo" },
    { name: "Laura Sánchez", department: "Tecnología", position: "Frontend Developer", hire_date: "2024-01-08", salary: 48000, status: "Activo" },
    { name: "Pedro Hernández", department: "Tecnología", position: "DevOps Engineer", hire_date: "2023-07-15", salary: 58000, status: "Activo" },
    { name: "Isabel Torres", department: "Marketing", position: "Content Manager", hire_date: "2024-02-01", salary: 42000, status: "Activo" },
    { name: "Roberto Díaz", department: "Ventas", position: "Account Executive", hire_date: "2025-01-15", salary: 43000, status: "Activo" },
    { name: "Patricia Morales", department: "RRHH", position: "Recruiter", hire_date: "2025-03-01", salary: 38000, status: "Activo" },
    { name: "Fernando Ruiz", department: "Tecnología", position: "Backend Developer", hire_date: "2025-02-10", salary: 52000, status: "Activo" },
    { name: "Claudia Vargas", department: "Marketing", position: "SEO Specialist", hire_date: "2025-04-01", salary: 40000, status: "Período de prueba" },
    { name: "Miguel Castillo", department: "Ventas", position: "Sales Rep", hire_date: "2024-11-01", salary: 35000, status: "Activo" },
    { name: "Sofía Mendoza", department: "Tecnología", position: "QA Engineer", hire_date: "2024-08-15", salary: 46000, status: "Activo" },
    { name: "Andrés Flores", department: "Operaciones", position: "Operations Analyst", hire_date: "2023-05-20", salary: 44000, status: "Activo" },
    { name: "Elena Ramos", department: "Finanzas", position: "Financial Analyst", hire_date: "2024-06-01", salary: 50000, status: "Activo" },
    { name: "Diego Navarro", department: "Tecnología", position: "Tech Lead", hire_date: "2022-03-01", salary: 72000, status: "Activo" },
    { name: "Valentina Cruz", department: "Marketing", position: "Brand Manager", hire_date: "2023-11-15", salary: 48000, status: "Activo" },
    { name: "Ricardo Peña", department: "Finanzas", position: "Controller", hire_date: "2021-01-10", salary: 68000, status: "Activo" },
    { name: "Daniela Ortiz", department: "Operaciones", position: "Project Manager", hire_date: "2024-04-01", salary: 52000, status: "Activo" },
    { name: "Alejandro Gil", department: "Ventas", position: "Regional Manager", hire_date: "2022-08-15", salary: 65000, status: "Baja" },
  ];

  for (const emp of employees) {
    await run(`db employees insert '${JSON.stringify(emp)}'`);
  }
  console.log(`   ${employees.length} employees inserted\n`);

  // ── 2. Agent builds the report step by step ─────────────
  console.log("2. Agent builds HR report...\n");

  // Create report
  await run(`report create "Reporte Mensual de Recursos Humanos" --subtitle="Mayo 2026 — Acme Corp"`);

  // KPIs
  const active = employees.filter(e => e.status === "Activo").length;
  const trial = employees.filter(e => e.status === "Período de prueba").length;
  const left = employees.filter(e => e.status === "Baja").length;
  const newHires = employees.filter(e => e.hire_date >= "2025-01-01").length;
  const avgSalary = Math.round(employees.filter(e => e.status !== "Baja").reduce((s, e) => s + e.salary, 0) / (active + trial));
  const totalPayroll = employees.filter(e => e.status !== "Baja").reduce((s, e) => s + e.salary, 0);

  await run(`report kpi "Empleados Activos" ${active}`);
  await run(`report kpi "En Período de Prueba" ${trial} --color=#f59e0b`);
  await run(`report kpi "Bajas" ${left} --trend=-1 --color=#ef4444`);
  await run(`report kpi "Contrataciones 2025" ${newHires} --trend=+${Math.round(newHires / employees.length * 100)}%`);
  await run(`report kpi "Salario Promedio" "$${avgSalary.toLocaleString()}" --color=#6366f1`);
  await run(`report kpi "Nómina Total" "$${totalPayroll.toLocaleString()}" --color=#10b981`);

  // Chart: by department
  const deptCounts = {};
  employees.filter(e => e.status !== "Baja").forEach(e => { deptCounts[e.department] = (deptCounts[e.department] || 0) + 1; });
  await run(`report chart pie '${JSON.stringify({
    title: "Distribución por Departamento",
    labels: Object.keys(deptCounts),
    values: Object.values(deptCounts),
  })}'`);

  // Chart: salary by department (avg)
  const deptSalary = {};
  const deptCount2 = {};
  employees.filter(e => e.status !== "Baja").forEach(e => {
    deptSalary[e.department] = (deptSalary[e.department] || 0) + e.salary;
    deptCount2[e.department] = (deptCount2[e.department] || 0) + 1;
  });
  const avgByDept = Object.keys(deptSalary).map(d => ({ dept: d, avg: Math.round(deptSalary[d] / deptCount2[d]) }));
  avgByDept.sort((a, b) => b.avg - a.avg);

  await run(`report chart bar '${JSON.stringify({
    title: "Salario Promedio por Departamento",
    labels: avgByDept.map(d => d.dept),
    values: avgByDept.map(d => d.avg),
  })}'`);

  // Chart: hires by quarter
  const quarters = { "2021": 0, "2022": 0, "2023": 0, "2024": 0, "2025": 0 };
  employees.forEach(e => {
    const year = e.hire_date.slice(0, 4);
    if (quarters[year] !== undefined) quarters[year]++;
  });
  await run(`report chart line '${JSON.stringify({
    title: "Contrataciones por Año",
    labels: Object.keys(quarters),
    values: Object.values(quarters),
  })}'`);

  // Chart: status doughnut
  const statusCounts = {};
  employees.forEach(e => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
  await run(`report chart doughnut '${JSON.stringify({
    title: "Estado de Empleados",
    labels: Object.keys(statusCounts),
    values: Object.values(statusCounts),
    colors: ["#10b981", "#f59e0b", "#ef4444"],
  })}'`);

  // Analysis text
  await run(`report text "## Análisis del Mes

El equipo creció a **${active} empleados activos** con **${newHires} nuevas incorporaciones** en 2025.

### Distribución por Departamento
- **Tecnología** lidera con ${deptCounts["Tecnología"] || 0} personas (${Math.round((deptCounts["Tecnología"] || 0) / active * 100)}% del headcount)
- **Ventas** cuenta con ${deptCounts["Ventas"] || 0} personas
- Se registró **${left} baja** en el período

### Compensación
- Salario promedio: **$${avgSalary.toLocaleString()}**
- Nómina mensual total: **$${totalPayroll.toLocaleString()}**
- El departamento con mayor salario promedio es **${avgByDept[0]?.dept}** ($${avgByDept[0]?.avg.toLocaleString()})

### Próximos pasos
- Revisar período de prueba de Claudia Vargas (vence junio 2025)
- Abrir búsqueda para reemplazar la posición de Alejandro Gil
- Evaluar ajuste salarial para el equipo de Marketing"`);

  // Employee table
  await run(`report table employees --title="Directorio de Empleados" --columns=name,department,position,hire_date,salary,status`);

  // Check status
  const status = await run(`report status`);
  console.log("   Report status:", status.stdout);

  // ── 3. Render ───────────────────────────────────────────
  console.log("\n3. Rendering HTML...");
  const renderR = await run(`report render --output=/reports/rrhh-mayo-2026.html`);
  console.log("   ", renderR.stdout);

  // ── 4. Extract HTML and save to disk for viewing ────────
  console.log("\n4. Saving to disk for viewing...");
  const html = await bash.readFile("/reports/rrhh-mayo-2026.html");
  const outPath = "/home/mauricioperera/Escritorio/just-bash-report/demo-rrhh.html";
  writeFileSync(outPath, html);
  console.log(`   Saved to: ${outPath}`);
  console.log(`   Open in browser to view the report!`);

  // ── 5. Test auto mode ───────────────────────────────────
  console.log("\n5. Testing auto-dashboard...");
  const autoR = await run(`report auto employees --title="Dashboard Automático RRHH" --output=/reports/auto.html`);
  console.log("   ", autoR.stdout);

  const autoHtml = await bash.readFile("/reports/auto.html");
  const autoPath = "/home/mauricioperera/Escritorio/just-bash-report/demo-auto.html";
  writeFileSync(autoPath, autoHtml);
  console.log(`   Auto dashboard saved to: ${autoPath}`);

  console.log("\n=== Done! ===");
}

main().catch(console.error);
