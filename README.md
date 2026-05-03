# just-bash-report

[![npm](https://img.shields.io/npm/v/just-bash-report)](https://www.npmjs.com/package/just-bash-report)
[![demos](https://img.shields.io/badge/demos-live-6366f1)](https://mauricioperera.github.io/just-bash-report/)

A [just-bash](https://github.com/vercel-labs/just-bash) plugin that generates self-contained HTML dashboards, invoices, and static sites from agent data. The LLM agent does the work — humans just open the file.

**[→ See live demos](https://mauricioperera.github.io/just-bash-report/)** (dashboards, invoices, static site).

Built on [just-bash-data](https://github.com/MauricioPerera/just-bash-data) for the storage layer.

## Install

Two install paths depending on what you want:

```bash
# Pure HTML generators only (no just-bash)
npm install just-bash-report

# Full plugin (LLM agent driving via bash commands)
npm install just-bash-report just-bash just-bash-data
```

`just-bash` and `just-bash-data` are **optional peer dependencies** since v2.0.0. If you only call `generateHtml`, `generateInvoiceHtml`, `generateIndex`, `generatePostPage`, `generateRss`, `parseBrandFile`, `mdToHtml`, or `getStrings`, you don't need them. Calling `createReportPlugin()` without them throws an error with the exact install command.

## Quick Start

```typescript
import { Bash, InMemoryFs } from "just-bash";
import { createReportPlugin } from "just-bash-report";

const bash = new Bash({
  fs: new InMemoryFs({}),
  customCommands: createReportPlugin({ rootDir: "/data" }),
});

// Agent builds a report step by step
await bash.exec(`report create "Monthly Report" --brand=/brand.md`);
await bash.exec(`report kpi "Revenue" 125000 --trend=+12%`);
await bash.exec(`report chart pie '{"labels":["Sales","Tech"],"values":[60,40],"title":"By Dept"}'`);
await bash.exec(`report table employees --title="Team"`);
await bash.exec(`report text "## Summary\\nStrong quarter."`);
await bash.exec(`report render --output=/reports/monthly.html`);
```

The output is a single HTML file with charts (Chart.js), sortable tables, KPI cards, and markdown sections. Opens in any browser, prints to PDF.

**Note on dependencies:** By default, reports load Chart.js from CDN and custom fonts from Google Fonts. Use `--offline` to inline Chart.js (~200 KB) and skip external fonts for fully self-contained files that work without internet. `--offline` is also accepted by `report invoice` and `report site`.

## Use without just-bash

The HTML generators are pure functions and exported from the package entry. You can use them directly with any data source — no `Bash` instance, no virtual filesystem, no plugin layer:

```typescript
import { generateHtml } from "just-bash-report";
import { writeFileSync } from "fs";

const html = generateHtml({
  title: "Q1 Report",
  generated: new Date().toISOString(),
  sections: [
    { kind: "kpi", label: "Revenue", value: 125000 },
    { kind: "chart", type: "pie", title: "By Dept", labels: ["Sales", "Tech"], values: [60, 40] },
  ],
});
writeFileSync("report.html", html);
```

All four generators are exported the same way:

```typescript
import {
  generateHtml,         // dashboards
  generateInvoiceHtml,  // invoices
  generateIndex,        // site index page
  generatePostPage,     // site post page
  generateRss,          // site RSS feed
  parseBrandFile,       // BRAND.md → BrandTokens
  brandToCssVars,       // BrandTokens → CSS custom properties string
  mdToHtml,             // minimal markdown → HTML
  getStrings,           // i18n dictionary lookup
} from "just-bash-report";
```

Use the plugin (`createReportPlugin`) when you want LLM agents to drive report construction via bash commands. Use the generators directly when your code already has the data shape and just needs HTML out.

## Brand Theming

Create a `BRAND.md` file with your company's design tokens (compatible with [google-labs-code/design.md](https://github.com/google-labs-code/design.md)):

```yaml
---
colors:
  primary: "#1e40af"
  secondary: "#7c3aed"
  accent: "#f59e0b"
  background: "#f8fafc"
  card: "#ffffff"
  text: "#1e293b"
  muted: "#64748b"
  success: "#10b981"
  danger: "#ef4444"

typography:
  heading:
    fontFamily: "Playfair Display, serif"
  body:
    fontFamily: "Inter, sans-serif"

logo: "https://your-company.com/logo.svg"
rounded: "12px"
---
```

Then pass `--brand=/path/to/BRAND.md` to any command. Colors, fonts, and logo are applied automatically. Google Fonts are loaded from CDN when custom font families are specified.

## Command Reference

### Dashboard Builder

```bash
# Start a new report
report create "Report Title" [--subtitle=...] [--brand=/path/to/BRAND.md] [--offline] [--locale=en|es] [--id=<name>]

# Add KPI cards
report kpi "Label" <value> [--trend=+12%] [--color=#hex] [--id=<name>]

# Add charts (Chart.js)
report chart <pie|bar|line|doughnut> '{"labels":[...],"values":[...],"title":"..."}' [--id=<name>]

# Add a table from a db collection
report table <collection> [--title=...] [--columns=col1,col2] [--limit=N] [--id=<name>]

# Add markdown text section
report text "<markdown>" [--id=<name>]

# Generate the HTML file
report render --output=/reports/output.html [--id=<name>]

# Check what's in the report so far
report status [--id=<name>]
```

### Building multiple reports in parallel (`--id`)

Without `--id`, all `report` commands share a single state slot inside the plugin instance. To build several reports concurrently within the same `Bash`, give each one a distinct id:

```bash
report create "Sales Q1" --id=sales
report create "Engineering Q1" --id=eng
report kpi "Revenue" 125000 --id=sales
report kpi "Deploys" 412 --id=eng
report render --id=sales --output=/sales.html
report render --id=eng --output=/eng.html
```

Omitting `--id` uses the `"default"` bucket — backwards-compatible. `report status` without `--id` shows whether the default bucket is active and lists any other ids in use.

### One-Shot Modes

```bash
# Auto-generate dashboard from any collection (detects field types)
report auto <collection> [--title=...] [--brand=...] [--output=...]

# Full report from a single JSON spec
report quick '{"title":"...","sections":[{"kind":"kpi",...},{"kind":"chart",...}]}'
```

`report auto` heuristically detects:
- Low-cardinality string fields → pie/bar charts
- Numeric fields → KPI cards (sum/avg)
- Date fields → line charts (count by month)
- All data → sortable table

### Invoice Generator

```bash
report invoice '<json>' [--brand=...] [--output=...] [--locale=en|es] [--offline]
```

Invoice JSON:

```json
{
  "number": "INV-2026-001",
  "date": "2026-05-02",
  "dueDate": "2026-06-01",
  "status": "sent",
  "from": { "name": "Acme Corp", "address": "...", "taxId": "..." },
  "to": { "name": "Client Inc", "address": "..." },
  "items": [
    { "description": "Consulting", "quantity": 40, "unitPrice": 150, "tax": 0.16 }
  ],
  "currency": "$",
  "taxLabel": "IVA 16%",
  "paymentInfo": "Bank: ...\nAccount: ...",
  "notes": "Due in 30 days"
}
```

Generates a print-ready invoice with line items, tax calculation, totals, status badge, and payment info.

### Static Site Generator

```bash
report site <collection> [--title=...] [--description=...] [--brand=...] [--output=/site] [--base-url=...] [--status=Published] [--locale=en|es] [--offline]
```

Reads posts from a `db` collection (compatible with js-doc-store's `content` template) and generates:
- `index.html` — post listing with cards, excerpts, tags
- `<slug>.html` — individual post pages with full content
- `rss.xml` — RSS feed

Posts are filtered by `Status` field (default: `"Published"`). Draft posts are excluded.

**Expected fields:** `Title`, `Body`, `Status`, `Author`, `Category`, `Tags`, `PublishedAt`, `slug` (auto-generated from title if missing).

**Custom field names:** Use `--field-title=nombre`, `--field-body=contenido`, `--field-status=estado`, etc. to map collection fields that don't match the defaults. All 8 fields are mappable: `--field-title`, `--field-body`, `--field-status`, `--field-author`, `--field-category`, `--field-tags`, `--field-date`, `--field-slug`.

## Localization (`--locale`)

Rendered output strings (search placeholder, table footer, dashboard footer, invoice labels, status badges, "Back to home" link, the `<html lang>` attribute, the RFC/Tax ID label, and labels derived by `report auto`) are localized.

Default locale is **`es`** to preserve v1.x behavior. To switch:

```bash
# Per-call
report create "Q1 Report" --locale=en
report invoice '...' --locale=en
report site content --locale=en

# Per-plugin (becomes the default for every command)
createReportPlugin({ rootDir: "/data", locale: "en" })

# Per-invoice JSON spec (highest precedence)
{ "number": "INV-001", "locale": "en", ... }
```

Supported locales today: `en`, `es`. Adding a new one is a single dict entry in [`src/i18n.ts`](src/i18n.ts).

## Architecture

```
LLM Agent
    │ report create/kpi/chart/table/text/render
    ▼
just-bash-report plugin
    ├── template.ts  → Dashboard HTML (Chart.js, tables, KPIs)
    ├── invoice.ts   → Invoice HTML (print-ready)
    ├── site.ts      → Static site (index + pages + RSS)
    ├── brand.ts     → BRAND.md parser → CSS custom properties
    └── md.ts        → Shared markdown-to-HTML converter
    │
    └── just-bash-data (db + vec)
```

All output is self-contained HTML. Charts use Chart.js from CDN. Custom fonts load from Google Fonts. No build step, no server — open in any browser.

## Exported Types

```typescript
import type {
  Section, KpiSection, ChartSection, TableSection, TextSection,
  ReportData, InvoiceData, InvoiceItem, InvoiceParty,
  SitePost, SiteConfig, BrandTokens,
  Locale, Strings,
} from "just-bash-report";
```

## Ecosystem

| Package | Description |
|---------|-------------|
| [just-bash-data](https://github.com/MauricioPerera/just-bash-data) | `db` + `vec` commands (storage + search) |
| [just-bash-wiki](https://github.com/MauricioPerera/just-bash-wiki) | LLM-maintained knowledge base |
| **just-bash-report** | Dashboards, invoices, and static sites (this package) |
| [js-doc-store](https://github.com/MauricioPerera/js-doc-store) | Document database engine |
| [js-vector-store](https://github.com/MauricioPerera/js-vector-store) | Vector similarity search engine |

## Concurrency

Report state is held in a `Map<id, ReportState>` per call to `createReportPlugin()`. Calls without `--id` share the `"default"` slot — a single sequence of `report create / kpi / chart / render` is safe.

To build several reports in parallel within the same `Bash` instance, give each one a distinct `--id` (see [Building multiple reports in parallel](#building-multiple-reports-in-parallel---id)).

Two separate `Bash` instances each get their own plugin state and are fully isolated. Note that if you cache the result of `createReportPlugin()` and pass it to multiple `Bash` instances, those instances will share state via the closure — call `createReportPlugin()` once per `Bash` for full isolation.

## License

MIT
