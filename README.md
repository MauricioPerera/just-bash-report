# just-bash-report

[![npm](https://img.shields.io/npm/v/just-bash-report)](https://www.npmjs.com/package/just-bash-report)

A [just-bash](https://github.com/vercel-labs/just-bash) plugin that generates self-contained HTML dashboards, invoices, and static sites from agent data. The LLM agent does the work — humans just open the file.

Built on [just-bash-data](https://github.com/MauricioPerera/just-bash-data) for the storage layer.

## Install

```bash
npm install just-bash-report
```

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

**Note on dependencies:** By default, reports load Chart.js from CDN and custom fonts from Google Fonts. Use `--offline` to inline Chart.js (~200KB) and skip external fonts for fully self-contained files that work without internet.

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
report create "Report Title" [--subtitle=...] [--brand=/path/to/BRAND.md] [--offline]

# Add KPI cards
report kpi "Label" <value> [--trend=+12%] [--color=#hex]

# Add charts (Chart.js)
report chart <pie|bar|line|doughnut> '{"labels":[...],"values":[...],"title":"..."}'

# Add a table from a db collection
report table <collection> [--title=...] [--columns=col1,col2] [--limit=N]

# Add markdown text section
report text "<markdown>"

# Generate the HTML file
report render --output=/reports/output.html

# Check what's in the report so far
report status
```

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
report invoice '<json>' [--brand=...] [--output=...]
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
report site <collection> [--title=...] [--description=...] [--brand=...] [--output=/site] [--base-url=...] [--status=Published]
```

Reads posts from a `db` collection (compatible with js-doc-store's `content` template) and generates:
- `index.html` — post listing with cards, excerpts, tags
- `<slug>.html` — individual post pages with full content
- `rss.xml` — RSS feed

Posts are filtered by `Status` field (default: `"Published"`). Draft posts are excluded.

**Expected fields:** `Title`, `Body`, `Status`, `Author`, `Category`, `Tags`, `PublishedAt`, `slug` (auto-generated from title if missing).

**Custom field names:** Use `--field-title=nombre`, `--field-body=contenido`, `--field-status=estado`, etc. to map collection fields that don't match the defaults. All 8 fields are mappable: `--field-title`, `--field-body`, `--field-status`, `--field-author`, `--field-category`, `--field-tags`, `--field-date`, `--field-slug`.

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

Report state lives in a per-command closure. Single-writer only — concurrent `report create` + `report kpi` calls from different contexts will interfere. Each `Bash` instance gets its own report state, so multiple instances are safe.

## License

MIT
