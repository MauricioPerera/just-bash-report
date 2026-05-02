import { Bash, InMemoryFs } from "just-bash";
import { createReportPlugin } from "./dist/index.js";
import { writeFileSync } from "fs";

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

typography:
  heading:
    fontFamily: "Playfair Display, serif"
  body:
    fontFamily: "Inter, sans-serif"

logo: "https://img.logoipsum.com/245.svg"
rounded: "12px"
---
`;

const bash = new Bash({
  fs: new InMemoryFs({ "/brand/BRAND.md": BRAND_MD }),
  customCommands: createReportPlugin({ rootDir: "/data" }),
});

async function main() {
  console.log("=== Invoice Test ===\n");

  const invoice = {
    number: "INV-2026-0042",
    date: "2026-05-02",
    dueDate: "2026-06-01",
    status: "sent",
    from: {
      name: "NovaCorp S.A. de C.V.",
      address: "Av. Revolución 1234, Col. Centro",
      city: "Ciudad de México, CDMX 06000",
      taxId: "NOV2201015A3",
      email: "facturacion@novacorp.mx",
      phone: "+52 55 1234 5678",
    },
    to: {
      name: "Distribuidora del Pacífico S.A.",
      address: "Blvd. Marina 567, Zona Dorada",
      city: "Mazatlán, Sinaloa 82110",
      taxId: "DPA1905082B1",
      email: "compras@distpacifico.mx",
    },
    items: [
      { description: "Consultoría estratégica — Mayo 2026", quantity: 40, unitPrice: 1500, tax: 0.16 },
      { description: "Desarrollo de plataforma web (fase 2)", quantity: 1, unitPrice: 85000, tax: 0.16 },
      { description: "Licencia SaaS Enterprise — anual", quantity: 1, unitPrice: 24000, tax: 0.16 },
      { description: "Capacitación equipo técnico (3 sesiones)", quantity: 3, unitPrice: 8000, tax: 0.16 },
      { description: "Hosting y mantenimiento mensual", quantity: 1, unitPrice: 4500, tax: 0.16 },
    ],
    currency: "$",
    taxLabel: "IVA 16%",
    notes: "Factura válida como comprobante fiscal digital (CFDI).\nTipo de pago: Transferencia bancaria.",
    paymentInfo: "Banco: BBVA México\nCuenta: 0123456789\nCLABE: 012180001234567893\nReferencia: INV-2026-0042",
  };

  // Branded invoice
  const r = await bash.exec(`report invoice '${JSON.stringify(invoice)}' --brand=/brand/BRAND.md --output=/invoices/branded.html`);
  console.log("Branded:", r.stdout);

  const html1 = await bash.readFile("/invoices/branded.html");
  writeFileSync("/home/mauricioperera/Escritorio/just-bash-report/demo-invoice-branded.html", html1);

  // Default invoice (no brand)
  const r2 = await bash.exec(`report invoice '${JSON.stringify(invoice)}' --output=/invoices/default.html`);
  console.log("Default:", r2.stdout);

  const html2 = await bash.readFile("/invoices/default.html");
  writeFileSync("/home/mauricioperera/Escritorio/just-bash-report/demo-invoice-default.html", html2);

  // Paid invoice
  invoice.status = "paid";
  invoice.number = "INV-2026-0041";
  const r3 = await bash.exec(`report invoice '${JSON.stringify(invoice)}' --brand=/brand/BRAND.md --output=/invoices/paid.html`);
  console.log("Paid:", r3.stdout);

  const html3 = await bash.readFile("/invoices/paid.html");
  writeFileSync("/home/mauricioperera/Escritorio/just-bash-report/demo-invoice-paid.html", html3);

  console.log("\nDone! Open demo-invoice-branded.html in browser.");
}

main().catch(console.error);
