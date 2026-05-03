import { defineCommand, type Command } from "just-bash";
import { createDataPlugin, type PluginOptions } from "just-bash-data";
import type { ExecResult } from "just-bash";
import { generateHtml, type Section, type ReportData, type KpiSection, type ChartSection, type TableSection, type TextSection } from "./template.js";
import { parseBrandFile, type BrandTokens } from "./brand.js";
import { generateInvoiceHtml, type InvoiceData, type InvoiceItem, type InvoiceParty } from "./invoice.js";
import { generateIndex, generatePostPage, generateRss, type SitePost, type SiteConfig } from "./site.js";

// ── Public types ──────────────────────────────────────────

export type { Section, ReportData, KpiSection, ChartSection, TableSection, TextSection, BrandTokens, InvoiceData, InvoiceItem, InvoiceParty, SitePost, SiteConfig };

export interface ReportOptions extends PluginOptions {}

// ── Helpers ───────────────────────────────────────────────

const esc = (s: string): string => s.replace(/'/g, "'\\''");
const ok = (stdout: string): ExecResult => ({ stdout, stderr: "", exitCode: 0 });
const fail = (code: number, msg: string): ExecResult => ({ stdout: "", stderr: `${msg}\n`, exitCode: code });

type Exec = (cmd: string) => Promise<ExecResult>;

const VALID_SECTION_KINDS = new Set(["kpi", "chart", "table", "text"]);

/**
 * Validate a single Section by kind. Returns null if valid, error message
 * otherwise. Used by reportQuick to fail fast with actionable errors instead
 * of crashing later inside generateHtml.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateSection(s: any, i: number): string | null {
  if (!s || typeof s !== "object" || !("kind" in s)) {
    return `section[${i}]: must have 'kind' field`;
  }
  const kind = s.kind;
  if (!VALID_SECTION_KINDS.has(kind)) {
    return `section[${i}]: unknown kind '${kind}' (valid: kpi, chart, table, text)`;
  }
  if (kind === "kpi") {
    if (!s.label || s.value === undefined) {
      return `section[${i}] kpi: requires 'label' and 'value'`;
    }
  } else if (kind === "chart") {
    if (!s.type || !Array.isArray(s.labels) || !Array.isArray(s.values)) {
      return `section[${i}] chart: requires 'type', 'labels'[], 'values'[]`;
    }
    if (s.labels.length !== s.values.length) {
      return `section[${i}] chart: labels.length (${s.labels.length}) !== values.length (${s.values.length})`;
    }
  } else if (kind === "table") {
    if (!Array.isArray(s.columns) || !Array.isArray(s.rows)) {
      return `section[${i}] table: requires 'columns'[] and 'rows'[]`;
    }
  } else if (kind === "text") {
    if (typeof s.content !== "string") {
      return `section[${i}] text: requires 'content' string`;
    }
  }
  return null;
}

/**
 * Write a file, creating parent directories if needed.
 * Returns null on success, error message on failure.
 * Never throws — callers can map the result to an ExecResult.
 */
async function safeWrite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fs: any,
  path: string,
  content: string,
): Promise<string | null> {
  try {
    await fs.writeFile(path, content);
    return null;
  } catch (e) {
    // Try to create parent dirs explicitly, then retry once.
    const dir = path.split("/").slice(0, -1).join("/");
    if (dir && typeof fs.mkdir === "function") {
      try { await fs.mkdir(dir, { recursive: true }); } catch { /* ignore */ }
      try {
        await fs.writeFile(path, content);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }
    return e instanceof Error ? e.message : String(e);
  }
}

// ── Report state per filesystem (closure, not global) ─────

interface ReportState {
  title: string;
  subtitle?: string;
  sections: Section[];
  brand?: BrandTokens;
  offline?: boolean;
}

function buildReportCommand(): Command {
  // Per-id report state. The default id is "default", so callers that don't
  // pass --id keep the original single-report-per-plugin behavior. Multiple
  // concurrent reports within one Bash instance can be built by passing
  // distinct --id values.
  const reports = new Map<string, ReportState>();
  const getId = (fl: Map<string, string>): string => fl.get("id") ?? "default";

  return defineCommand("report", async (args, ctx) => {
    const exec: Exec = (cmd: string) => {
      if (!ctx.exec) return Promise.resolve({ stdout: "", stderr: "ctx.exec unavailable", exitCode: 1 } as ExecResult);
      return ctx.exec(cmd, { cwd: ctx.cwd });
    };

    const positional: string[] = [];
    const flags = new Map<string, string>();
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
    if (!sub) return fail(2, "usage: report <create|kpi|chart|table|text|auto|render|quick|invoice|site> [...] [--id=<name>]");

    switch (sub) {
      case "create": return await reportCreate(positional, flags);
      case "kpi": return reportKpi(positional, flags);
      case "chart": return reportChart(positional, flags);
      case "table": return reportTable(exec, positional, flags);
      case "text": return reportText(positional, flags);
      case "render": return reportRender(ctx, flags);
      case "auto": return reportAuto(exec, positional, flags, ctx);
      case "quick": return reportQuick(exec, positional, flags, ctx);
      case "status": return reportStatus(flags);
      case "invoice": return reportInvoice(positional, flags);
      case "site": return reportSite(exec, positional, flags);
      default: return fail(2, `unknown report command: ${sub}`);
    }

    // ── CREATE ────────────────────────────────────────────

    async function reportCreate(pos: string[], fl: Map<string, string>): Promise<ExecResult> {
      const title = pos.slice(1).join(" ");
      if (!title) return fail(2, "usage: report create <title> [--subtitle=...] [--brand=/path/to/BRAND.md]");

      let brand: BrandTokens | undefined;
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          const brandContent = await ctx.fs.readFile(brandPath, "utf8");
          brand = parseBrandFile(brandContent);
        } catch {
          return fail(2, `cannot read brand file: ${brandPath}`);
        }
      }

      const offline = fl.get("offline") === "true";
      const id = getId(fl);
      reports.set(id, { title, subtitle: fl.get("subtitle"), sections: [], brand, offline });
      return ok(JSON.stringify({ created: true, title, brand: !!brand, offline, id }));
    }

    // ── KPI ───────────────────────────────────────────────

    function reportKpi(pos: string[], fl: Map<string, string>): ExecResult {
      const id = getId(fl);
      const current = reports.get(id);
      if (!current) return fail(2, `no report created${id !== "default" ? ` for id '${id}'` : ""}. Run 'report create <title>${id !== "default" ? ` --id=${id}` : ""}' first`);
      const label = pos[1];
      const value = pos[2];
      if (!label || value === undefined) return fail(2, "usage: report kpi <label> <value> [--trend=+12%] [--color=#hex] [--id=<name>]");

      const kpi: KpiSection = {
        kind: "kpi",
        label,
        value: isNaN(Number(value)) ? value : Number(value),
        trend: fl.get("trend"),
        color: fl.get("color"),
      };
      current.sections.push(kpi);
      return ok(JSON.stringify({ added: "kpi", label }));
    }

    // ── CHART ─────────────────────────────────────────────

    function reportChart(pos: string[], fl: Map<string, string>): ExecResult {
      const id = getId(fl);
      const current = reports.get(id);
      if (!current) return fail(2, `no report created${id !== "default" ? ` for id '${id}'` : ""}. Run 'report create <title>${id !== "default" ? ` --id=${id}` : ""}' first`);
      const chartType = pos[1] as "pie" | "bar" | "line" | "doughnut";
      const jsonArg = pos.slice(2).join(" ");
      if (!chartType || !jsonArg) return fail(2, "usage: report chart <pie|bar|line|doughnut> '<json>' [--id=<name>]");

      let data: { labels: string[]; values: number[]; title?: string; colors?: string[] };
      try { data = JSON.parse(jsonArg); } catch { return fail(2, "invalid chart json"); }

      if (!data.labels || !data.values) return fail(2, "chart json must have 'labels' and 'values' arrays");

      const chart: ChartSection = {
        kind: "chart",
        type: chartType,
        title: data.title ?? chartType,
        labels: data.labels,
        values: data.values,
        colors: data.colors,
      };
      current.sections.push(chart);
      return ok(JSON.stringify({ added: "chart", type: chartType, title: chart.title }));
    }

    // ── TABLE ─────────────────────────────────────────────

    async function reportTable(exec: Exec, pos: string[], fl: Map<string, string>): Promise<ExecResult> {
      const id = getId(fl);
      const current = reports.get(id);
      if (!current) return fail(2, `no report created${id !== "default" ? ` for id '${id}'` : ""}. Run 'report create <title>${id !== "default" ? ` --id=${id}` : ""}' first`);
      const source = pos[1]; // collection name or JSON data
      if (!source) return fail(2, "usage: report table <collection|json> [--title=...] [--columns=col1,col2] [--id=<name>]");

      const title = fl.get("title") ?? source;
      const columnsFlag = fl.get("columns");
      const limit = fl.get("limit");

      let rows: Array<Record<string, unknown>>;
      let columns: string[];

      // Try to parse as JSON first
      try {
        rows = JSON.parse(source);
        if (!Array.isArray(rows)) throw new Error("not array");
      } catch {
        // Treat as collection name — fetch from db
        let cmd = `db ${source} find '{}'`;
        if (limit) cmd += ` --limit ${limit}`;
        const r = await exec(cmd);
        if (r.exitCode !== 0) return fail(r.exitCode, `cannot read collection '${source}': ${r.stderr.trim()}`);
        rows = JSON.parse(r.stdout);
      }

      if (columnsFlag) {
        columns = columnsFlag.split(",").map(c => c.trim());
      } else if (rows.length > 0) {
        // Auto-detect columns, excluding _id
        columns = Object.keys(rows[0]).filter(k => k !== "_id");
      } else {
        columns = [];
      }

      const table: TableSection = { kind: "table", title, columns, rows };
      current.sections.push(table);
      return ok(JSON.stringify({ added: "table", title, rows: rows.length, columns: columns.length }));
    }

    // ── TEXT ───────────────────────────────────────────────

    function reportText(pos: string[], fl: Map<string, string>): ExecResult {
      const id = getId(fl);
      const current = reports.get(id);
      if (!current) return fail(2, `no report created${id !== "default" ? ` for id '${id}'` : ""}. Run 'report create <title>${id !== "default" ? ` --id=${id}` : ""}' first`);
      const content = pos.slice(1).join(" ");
      if (!content) return fail(2, "usage: report text '<markdown>' [--id=<name>]");

      current.sections.push({ kind: "text", content });
      return ok(JSON.stringify({ added: "text", length: content.length }));
    }

    // ── RENDER ────────────────────────────────────────────

    async function reportRender(_ctx: unknown, fl: Map<string, string>): Promise<ExecResult> {
      const id = getId(fl);
      const current = reports.get(id);
      if (!current) return fail(2, `no report created${id !== "default" ? ` for id '${id}'` : ""}. Run 'report create <title>${id !== "default" ? ` --id=${id}` : ""}' first`);

      const output = fl.get("output") ?? "/reports/report.html";
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      const reportData: ReportData = {
        title: current.title,
        subtitle: current.subtitle,
        generated: now,
        sections: current.sections,
        brand: current.brand,
        logo: current.brand?.logo,
        offline: current.offline,
      };

      const html = generateHtml(reportData);

      const writeErr = await safeWrite(ctx.fs, output, html);
      if (writeErr) return fail(1, `cannot write ${output}: ${writeErr}`);

      return ok(JSON.stringify({
        rendered: true,
        output,
        title: current.title,
        sections: current.sections.length,
        sizeBytes: html.length,
      }));
    }

    // ── AUTO ──────────────────────────────────────────────
    // Auto-generate a dashboard from a db collection

    async function reportAuto(exec: Exec, pos: string[], fl: Map<string, string>, _ctx: unknown): Promise<ExecResult> {
      const collection = pos[1];
      if (!collection) return fail(2, "usage: report auto <collection> [--title=...] [--output=...]");

      const title = fl.get("title") ?? `${collection} Dashboard`;
      const output = fl.get("output") ?? `/reports/${collection}.html`;

      // Load brand if specified
      let brand: BrandTokens | undefined;
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          const brandContent = await ctx.fs.readFile(brandPath, "utf8");
          brand = parseBrandFile(brandContent);
        } catch { /* no brand, use defaults */ }
      }

      // Get all docs
      const docsR = await exec(`db ${collection} find '{}'`);
      if (docsR.exitCode !== 0) return fail(docsR.exitCode, docsR.stderr.trim());
      const docs = JSON.parse(docsR.stdout) as Array<Record<string, unknown>>;

      const id = getId(fl);
      const current: ReportState = { title, sections: [], brand };
      reports.set(id, current);

      // KPI: total count
      current.sections.push({ kind: "kpi", label: "Total Registros", value: docs.length });

      // Auto-detect fields
      if (docs.length > 0) {
        const sample = docs[0];
        const fields = Object.keys(sample).filter(k => k !== "_id");

        // Find select-like fields (low cardinality strings) → pie chart
        for (const field of fields) {
          const values = docs.map(d => d[field]).filter(v => typeof v === "string");
          if (values.length === 0) continue;
          const unique = [...new Set(values)];
          if (unique.length >= 2 && unique.length <= 15 && unique.length < docs.length * 0.5) {
            const counts: Record<string, number> = {};
            for (const v of values) counts[v as string] = (counts[v as string] ?? 0) + 1;
            current.sections.push({
              kind: "chart",
              type: unique.length <= 6 ? "pie" : "bar",
              title: `Por ${field}`,
              labels: Object.keys(counts),
              values: Object.values(counts),
            });
            // KPI per top category
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            if (top) {
              current.sections.push({ kind: "kpi", label: `${field}: ${top[0]}`, value: top[1] });
            }
          }
        }

        // Find numeric fields → KPIs (sum/avg)
        for (const field of fields) {
          const nums = docs.map(d => d[field]).filter(v => typeof v === "number") as number[];
          if (nums.length < docs.length * 0.5) continue;
          const sum = nums.reduce((a, b) => a + b, 0);
          const avg = Math.round(sum / nums.length * 100) / 100;
          current.sections.push({ kind: "kpi", label: `${field} (promedio)`, value: avg });
          current.sections.push({ kind: "kpi", label: `${field} (total)`, value: sum });
        }

        // Find date fields → line chart (count by month)
        for (const field of fields) {
          const dates = docs.map(d => d[field]).filter(v => typeof v === "string" && /^\d{4}-\d{2}/.test(v as string)) as string[];
          if (dates.length < docs.length * 0.3) continue;
          const byMonth: Record<string, number> = {};
          for (const d of dates) {
            const month = (d as string).slice(0, 7);
            byMonth[month] = (byMonth[month] ?? 0) + 1;
          }
          const sorted = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
          if (sorted.length >= 2) {
            current.sections.push({
              kind: "chart",
              type: "line",
              title: `${field} por mes`,
              labels: sorted.map(([k]) => k),
              values: sorted.map(([, v]) => v),
            });
          }
        }

        // Table with all data
        const columns = fields.slice(0, 8); // cap at 8 columns for readability
        current.sections.push({
          kind: "table",
          title: `Datos: ${collection}`,
          columns,
          rows: docs,
        });
      }

      // Render
      return reportRender(ctx, new Map([["output", output]]));
    }

    // ── QUICK ─────────────────────────────────────────────
    // One-shot: create + sections from JSON + render

    async function reportQuick(_exec: Exec, pos: string[], fl: Map<string, string>, _ctx: unknown): Promise<ExecResult> {
      const jsonArg = pos.slice(1).join(" ");
      if (!jsonArg) return fail(2, "usage: report quick '<json>' [--output=...]");

      let spec: { title: string; subtitle?: string; sections: Section[] };
      try { spec = JSON.parse(jsonArg); } catch { return fail(2, "invalid json"); }

      if (!spec.title || !spec.sections) return fail(2, "json must have 'title' and 'sections'");

      for (let i = 0; i < spec.sections.length; i++) {
        const err = validateSection(spec.sections[i], i);
        if (err) return fail(2, err);
      }

      const id = getId(fl);
      reports.set(id, { title: spec.title, subtitle: spec.subtitle, sections: spec.sections });
      return reportRender(ctx, fl);
    }

    // ── STATUS ────────────────────────────────────────────

    async function reportSite(exec: Exec, pos: string[], fl: Map<string, string>): Promise<ExecResult> {
      const collection = pos[1] ?? "content";
      const title = fl.get("title") ?? "Mi Sitio";
      const description = fl.get("description");
      const baseUrl = fl.get("base-url") ?? "";
      const outputDir = fl.get("output") ?? "/site";

      // Field mapping — allows using collections with non-standard field names
      const fTitle = fl.get("field-title") ?? "Title";
      const fBody = fl.get("field-body") ?? "Body";
      const fStatus = fl.get("field-status") ?? "Status";
      const fAuthor = fl.get("field-author") ?? "Author";
      const fCategory = fl.get("field-category") ?? "Category";
      const fTags = fl.get("field-tags") ?? "Tags";
      const fDate = fl.get("field-date") ?? "PublishedAt";
      const fSlug = fl.get("field-slug") ?? "slug";
      const statusFilter = fl.get("status") ?? "Published";

      // Load brand
      let brand: BrandTokens | undefined;
      const brandPath = fl.get("brand");
      if (brandPath) {
        try { brand = parseBrandFile(await ctx.fs.readFile(brandPath, "utf8")); } catch { /* defaults */ }
      }

      // Fetch published posts
      const filter = JSON.stringify({ [fStatus]: statusFilter });
      const r = await exec(`db ${collection} find '${filter.replace(/'/g, "'\\''")}'`);
      if (r.exitCode !== 0) return fail(r.exitCode, `cannot read collection '${collection}': ${r.stderr.trim()}`);

      // Map fields to standard SitePost shape
      const rawDocs = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
      const posts: SitePost[] = rawDocs.map(d => ({
        _id: d._id as string,
        Title: (d[fTitle] as string) ?? "",
        Body: (d[fBody] as string) ?? "",
        Author: d[fAuthor] as string | undefined,
        Status: (d[fStatus] as string) ?? "",
        Category: d[fCategory] as string | undefined,
        Tags: d[fTags] as string[] | undefined,
        PublishedAt: d[fDate] as string | undefined,
        slug: d[fSlug] as string | undefined,
        CreatedAt: d.CreatedAt as string | undefined,
      }));

      posts.sort((a, b) => (b.PublishedAt ?? b.CreatedAt ?? "").localeCompare(a.PublishedAt ?? a.CreatedAt ?? ""));

      const config: SiteConfig = { title, description, baseUrl, brand };

      // Generate index
      const indexHtml = generateIndex(posts, config);
      await ctx.fs.writeFile(`${outputDir}/index.html`, indexHtml);

      // Generate individual post pages
      for (const post of posts) {
        const slug = post.slug ?? post.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const postHtml = generatePostPage(post, config);
        await ctx.fs.writeFile(`${outputDir}/${slug}.html`, postHtml);
      }

      // Generate RSS
      const rss = generateRss(posts, config);
      await ctx.fs.writeFile(`${outputDir}/rss.xml`, rss);

      return ok(JSON.stringify({
        site: true,
        output: outputDir,
        htmlPages: posts.length + 1, // posts + index
        feeds: 1,
        posts: posts.map(p => p.slug ?? p.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
        files: [`index.html`, ...posts.map(p => `${p.slug ?? p.Title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`), `rss.xml`],
      }));
    }

    async function reportInvoice(pos: string[], fl: Map<string, string>): Promise<ExecResult> {
      const jsonArg = pos.slice(1).join(" ");
      if (!jsonArg) return fail(2, "usage: report invoice '<json>' [--brand=/path] [--output=/path.html]");

      let data: InvoiceData;
      try { data = JSON.parse(jsonArg); } catch { return fail(2, "invalid invoice json"); }

      if (!data.number || !data.from || !data.to || !data.items) {
        return fail(2, "invoice json requires: number, from, to, items");
      }

      // Load brand
      const brandPath = fl.get("brand");
      if (brandPath) {
        try {
          const brandContent = await ctx.fs.readFile(brandPath, "utf8");
          data.brand = parseBrandFile(brandContent);
        } catch { /* use defaults */ }
      }

      const html = generateInvoiceHtml(data);
      const output = fl.get("output") ?? `/invoices/${data.number}.html`;

      const writeErr = await safeWrite(ctx.fs, output, html);
      if (writeErr) return fail(1, `cannot write ${output}: ${writeErr}`);

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
        sizeBytes: html.length,
      }));
    }

    function reportStatus(fl: Map<string, string>): ExecResult {
      const id = getId(fl);
      const current = reports.get(id);
      if (!current) {
        // If --id not specified, also report all known ids so callers can discover them
        if (!fl.has("id") && reports.size > 0) {
          return ok(JSON.stringify({ active: false, ids: [...reports.keys()] }));
        }
        return ok(JSON.stringify({ active: false }));
      }
      return ok(JSON.stringify({
        active: true,
        id,
        title: current.title,
        sections: current.sections.length,
        breakdown: {
          kpis: current.sections.filter(s => s.kind === "kpi").length,
          charts: current.sections.filter(s => s.kind === "chart").length,
          tables: current.sections.filter(s => s.kind === "table").length,
          texts: current.sections.filter(s => s.kind === "text").length,
        },
      }));
    }
  });
}

// ── Plugin Factory ────────────────────────────────────────

export function createReportPlugin(opts: ReportOptions = {}): Command[] {
  const dataPlugin = createDataPlugin({
    rootDir: opts.rootDir ?? "/data",
    encryptionKey: opts.encryptionKey,
    authSecret: opts.authSecret,
    salt: opts.salt,
  });

  return [...dataPlugin, buildReportCommand()] as Command[];
}
