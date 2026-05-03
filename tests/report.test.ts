import { describe, it, expect, beforeEach } from "vitest";
import { Bash, InMemoryFs } from "just-bash";
import { createReportPlugin } from "../src/index.js";

let bash: InstanceType<typeof Bash>;

const run = async (cmd: string) => {
  const r = await bash.exec(cmd);
  return { out: r.stdout, err: r.stderr, code: r.exitCode };
};

const json = <T = unknown>(s: string): T => JSON.parse(s);

const BRAND = `---
colors:
  primary: "#1a1a2e"
  secondary: "#16213e"
  accent: "#e94560"
  background: "#f5f5f5"
  card: "#ffffff"
  text: "#1a1a2e"
  muted: "#666"
typography:
  heading:
    fontFamily: "Georgia, serif"
  body:
    fontFamily: "Helvetica, sans-serif"
logo: "https://example.com/logo.svg"
---
`;

beforeEach(() => {
  bash = new Bash({
    fs: new InMemoryFs({ "/brand.md": BRAND }),
    customCommands: createReportPlugin({ rootDir: "/data" }),
  });
});

describe("report create + render", () => {
  it("creates and renders a report", async () => {
    await run(`report create "Test Report"`);
    await run(`report kpi "Users" 100`);
    const r = await run(`report render --output=/out.html`);
    expect(r.code).toBe(0);
    const data = json<{ rendered: boolean; sizeBytes: number }>(r.out);
    expect(data.rendered).toBe(true);
    expect(data.sizeBytes).toBeGreaterThan(0);

    const html = await bash.readFile("/out.html");
    expect(html).toContain("Test Report");
    expect(html).toContain("100");
    expect(html).toContain("Users");
  });

  it("render fails without create", async () => {
    const r = await run(`report render`);
    expect(r.code).toBe(2);
  });
});

describe("report kpi", () => {
  it("adds KPI with trend", async () => {
    await run(`report create "T"`);
    const r = await run(`report kpi "Revenue" 50000 --trend=+12%`);
    expect(r.code).toBe(0);
    const s = await run(`report status`);
    expect(json<{ breakdown: { kpis: number } }>(s.out).breakdown.kpis).toBe(1);
  });
});

describe("report chart", () => {
  it("adds pie chart", async () => {
    await run(`report create "T"`);
    const r = await run(`report chart pie '{"labels":["A","B"],"values":[10,20],"title":"Test"}'`);
    expect(r.code).toBe(0);
    await run(`report render --output=/out.html`);
    const html = await bash.readFile("/out.html");
    expect(html).toContain("chart_0");
    expect(html).toContain("Test");
  });

  it("escapes </script> in chart data", async () => {
    await run(`report create "T"`);
    await run(`report chart bar '{"labels":["</script>"],"values":[1],"title":"X"}'`);
    await run(`report render --output=/out.html`);
    const html = await bash.readFile("/out.html");
    expect(html).not.toContain('"</script>"');
    expect(html).toContain("<\\/script>");
  });
});

describe("report table", () => {
  it("adds table from collection", async () => {
    await run(`db items insert '{"name":"A","price":10}'`);
    await run(`db items insert '{"name":"B","price":20}'`);
    await run(`report create "T"`);
    const r = await run(`report table items --title="Products"`);
    expect(r.code).toBe(0);
    expect(json<{ rows: number }>(r.out).rows).toBe(2);
  });
});

describe("report text", () => {
  it("renders markdown headers", async () => {
    await run(`report create "T"`);
    await run(`report text "## Hello World"`);
    await run(`report render --output=/out.html`);
    const html = await bash.readFile("/out.html");
    expect(html).toContain("<h2>");
    expect(html).toContain("Hello World");
  });
});

describe("report auto", () => {
  it("auto-generates dashboard", async () => {
    await run(`db employees insert '{"name":"A","dept":"Sales","salary":50000}'`);
    await run(`db employees insert '{"name":"B","dept":"Tech","salary":60000}'`);
    await run(`db employees insert '{"name":"C","dept":"Sales","salary":45000}'`);
    const r = await run(`report auto employees --output=/auto.html`);
    expect(r.code).toBe(0);
    const html = await bash.readFile("/auto.html");
    expect(html).toContain("employees Dashboard");
    expect(html).toContain("Total Registros");
  });
});

describe("report quick", () => {
  it("renders from single JSON", async () => {
    const spec = JSON.stringify({
      title: "Quick",
      sections: [
        { kind: "kpi", label: "X", value: 42 },
        { kind: "text", content: "Hello" },
      ],
    });
    const r = await run(`report quick '${spec}' --output=/quick.html`);
    expect(r.code).toBe(0);
    const html = await bash.readFile("/quick.html");
    expect(html).toContain("Quick");
    expect(html).toContain("42");
  });

  it("rejects unknown section kind", async () => {
    const spec = JSON.stringify({
      title: "Bad",
      sections: [{ kind: "unknown", data: 1 }],
    });
    const r = await run(`report quick '${spec}'`);
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown kind");
  });
});

describe("report invoice", () => {
  it("generates invoice HTML", async () => {
    const inv = JSON.stringify({
      number: "INV-001",
      date: "2026-05-02",
      from: { name: "Acme" },
      to: { name: "Client" },
      items: [{ description: "Service", quantity: 1, unitPrice: 1000, tax: 0.16 }],
    });
    const r = await run(`report invoice '${inv}' --output=/inv.html`);
    expect(r.code).toBe(0);
    const data = json<{ total: number }>(r.out);
    expect(data.total).toBe(1160);

    const html = await bash.readFile("/inv.html");
    expect(html).toContain("INV-001");
    expect(html).toContain("Acme");
    expect(html).toContain("$1,160.00");
  });

  it("rejects missing fields", async () => {
    const r = await run(`report invoice '{"number":"X"}'`);
    expect(r.code).toBe(2);
  });
});

describe("report site", () => {
  beforeEach(async () => {
    await run(`db blog insert '{"Title":"Post 1","Body":"Hello world","Status":"Published","Author":"Ana","PublishedAt":"2026-05-01"}'`);
    await run(`db blog insert '{"Title":"Post 2","Body":"Another post","Status":"Published","Author":"Bob","PublishedAt":"2026-05-02"}'`);
    await run(`db blog insert '{"Title":"Draft","Body":"WIP","Status":"Draft"}'`);
  });

  it("generates index + pages + RSS", async () => {
    const r = await run(`report site blog --title="Test Blog" --output=/site`);
    expect(r.code).toBe(0);
    const data = json<{ htmlPages: number; feeds: number; files: string[] }>(r.out);
    expect(data.htmlPages).toBe(3); // 2 posts + index
    expect(data.feeds).toBe(1);
    expect(data.files).toContain("index.html");
    expect(data.files).toContain("rss.xml");

    const index = await bash.readFile("/site/index.html");
    expect(index).toContain("Post 1");
    expect(index).toContain("Post 2");
    expect(index).not.toContain("Draft"); // excluded by status filter
  });

  it("generates RSS feed", async () => {
    await run(`report site blog --output=/site`);
    const rss = await bash.readFile("/site/rss.xml");
    expect(rss).toContain("<rss");
    expect(rss).toContain("Post 1");
  });
});

describe("brand theming", () => {
  it("applies brand colors and logo", async () => {
    await run(`report create "Branded" --brand=/brand.md`);
    await run(`report kpi "X" 1`);
    await run(`report render --output=/branded.html`);
    const html = await bash.readFile("/branded.html");
    expect(html).toContain("#1a1a2e"); // primary color
    expect(html).toContain("logo.svg");
    expect(html).toContain("--font-heading"); // CSS var from brand
  });

  it("works without brand (defaults)", async () => {
    await run(`report create "No Brand"`);
    await run(`report kpi "X" 1`);
    await run(`report render --output=/no-brand.html`);
    const html = await bash.readFile("/no-brand.html");
    expect(html).toContain("#6366f1"); // default accent
    expect(html).not.toContain("logo.svg");
  });

  it("applies brand to invoice", async () => {
    const inv = JSON.stringify({
      number: "B-001", date: "2026-05-02",
      from: { name: "X" }, to: { name: "Y" },
      items: [{ description: "S", quantity: 1, unitPrice: 100 }],
    });
    await run(`report invoice '${inv}' --brand=/brand.md --output=/b-inv.html`);
    const html = await bash.readFile("/b-inv.html");
    expect(html).toContain("#1a1a2e");
    expect(html).toContain("logo.svg");
  });
});

describe("offline mode", () => {
  it("inlines Chart.js in offline mode", async () => {
    await run(`report create "T" --offline`);
    await run(`report kpi "X" 1`);
    await run(`report chart pie '{"labels":["A"],"values":[1],"title":"T"}'`);
    await run(`report render --output=/offline.html`);
    const html = await bash.readFile("/offline.html");
    expect(html).not.toContain("cdn.jsdelivr.net");
    // Chart.js source is inlined — verify library is present
    expect(html.length).toBeGreaterThan(200000); // Chart.js adds ~200KB
    expect(html).toContain("new Chart(");
  });

  it("includes Chart.js CDN by default", async () => {
    await run(`report create "T"`);
    await run(`report kpi "X" 1`);
    await run(`report render --output=/online.html`);
    const html = await bash.readFile("/online.html");
    expect(html).toContain("cdn.jsdelivr.net/npm/chart.js");
  });
});

describe("BRAND.md chartColors array", () => {
  it("parses YAML sequence chartColors", async () => {
    const brand = `---
colors:
  primary: "#ff0000"
  text: "#000"
chartColors:
  - "#ff0000"
  - "#00ff00"
  - "#0000ff"
---
`;
    const customBash = new Bash({
      fs: new InMemoryFs({ "/b.md": brand }),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await customBash.exec(`report create "T" --brand=/b.md`);
    await customBash.exec(`report chart pie '{"labels":["A","B","C"],"values":[1,2,3],"title":"X"}'`);
    await customBash.exec(`report render --output=/colors.html`);
    const html = await customBash.readFile("/colors.html");
    expect(html).toContain("#ff0000");
    expect(html).toContain("#00ff00");
    expect(html).toContain("#0000ff");
  });
});

describe("BRAND.md edge cases", () => {
  it("falls back to defaults when no front matter", async () => {
    const customBash = new Bash({
      fs: new InMemoryFs({ "/b.md": "# No front matter here" }),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await customBash.exec(`report create "T" --brand=/b.md`);
    await customBash.exec(`report kpi "X" 1`);
    await customBash.exec(`report render --output=/r.html`);
    const html = await customBash.readFile("/r.html");
    expect(html).toContain("#6366f1"); // default accent
  });
});

describe("report site field mapping", () => {
  it("maps custom field names", async () => {
    await run(`db posts insert '{"titulo":"Post A","contenido":"Hello","estado":"publicado","autor":"Ana"}'`);
    await run(`db posts insert '{"titulo":"Post B","contenido":"World","estado":"publicado","autor":"Bob"}'`);
    await run(`db posts insert '{"titulo":"Draft","contenido":"WIP","estado":"borrador"}'`);

    const r = await run(`report site posts --title="Blog" --output=/mapped --field-title=titulo --field-body=contenido --field-status=estado --field-author=autor --status=publicado`);
    expect(r.code).toBe(0);

    const index = await bash.readFile("/mapped/index.html");
    expect(index).toContain("Post A");
    expect(index).toContain("Post B");
    expect(index).not.toContain("Draft");
  });
});

describe("edge cases", () => {
  it("no subcommand returns usage", async () => {
    const r = await run("report");
    expect(r.code).toBe(2);
  });

  it("unknown subcommand returns error", async () => {
    const r = await run("report unknown");
    expect(r.code).toBe(2);
  });

  it("status with no active report", async () => {
    const r = await run("report status");
    expect(r.code).toBe(0);
    expect(json<{ active: boolean }>(r.out).active).toBe(false);
  });
});

// ── Issue #7: --offline honored in invoice and site ──────

const FONT_BRAND = `---
colors:
  primary: "#000"
  secondary: "#111"
  accent: "#222"
  background: "#fff"
  card: "#fff"
  text: "#000"
  muted: "#666"
typography:
  heading:
    fontFamily: "Playfair Display, serif"
  body:
    fontFamily: "Inter, sans-serif"
---
`;

describe("issue #7: --offline honored in invoice and site", () => {
  it("invoice without --offline includes Google Fonts CDN link when brand has custom fonts", async () => {
    const fontsBash = new Bash({
      fs: new InMemoryFs({ "/brand.md": FONT_BRAND }),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    const r = await fontsBash.exec(`report invoice '${JSON.stringify({
      number: "X", date: "2026", from: { name: "A" }, to: { name: "B" },
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
    })}' --brand=/brand.md --output=/x.html`);
    expect(r.exitCode).toBe(0);
    const html = await fontsBash.readFile("/x.html");
    expect(html).toContain("fonts.googleapis.com");
  });

  it("invoice with --offline skips Google Fonts and leaves a comment", async () => {
    const fontsBash = new Bash({
      fs: new InMemoryFs({ "/brand.md": FONT_BRAND }),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    const r = await fontsBash.exec(`report invoice '${JSON.stringify({
      number: "X", date: "2026", from: { name: "A" }, to: { name: "B" },
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
    })}' --brand=/brand.md --output=/x.html --offline`);
    expect(r.exitCode).toBe(0);
    const html = await fontsBash.readFile("/x.html");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).toContain("offline mode");
  });

  it("site without --offline includes Google Fonts CDN link", async () => {
    const fontsBash = new Bash({
      fs: new InMemoryFs({ "/brand.md": FONT_BRAND }),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await fontsBash.exec(`db content insert '{"Title":"A","Body":"a","Status":"Published"}'`);
    await fontsBash.exec(`report site content --brand=/brand.md --output=/s`);
    const idx = await fontsBash.readFile("/s/index.html");
    expect(idx).toContain("fonts.googleapis.com");
  });

  it("site with --offline skips Google Fonts in index AND post pages", async () => {
    const fontsBash = new Bash({
      fs: new InMemoryFs({ "/brand.md": FONT_BRAND }),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await fontsBash.exec(`db content insert '{"Title":"A","Body":"a","Status":"Published"}'`);
    await fontsBash.exec(`report site content --brand=/brand.md --output=/s --offline`);
    const idx = await fontsBash.readFile("/s/index.html");
    const post = await fontsBash.readFile("/s/a.html");
    expect(idx).not.toContain("fonts.googleapis.com");
    expect(post).not.toContain("fonts.googleapis.com");
    expect(idx).toContain("offline mode");
  });
});

// ── Issue #6: locale option (i18n) ───────────────────────

describe("issue #6: locale (i18n)", () => {
  it("default locale is 'es' (backwards compat)", async () => {
    await run(`db users insert '{"name":"X"}'`);
    await run(`report create "T"`);
    await run(`report table users --title=People`);
    await run(`report render --output=/o.html`);
    const html = await bash.readFile("/o.html");
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("Buscar...");
    expect(html).toContain("Generado:");
    expect(html).toContain("registros");
  });

  it("--locale=en switches strings on render", async () => {
    await run(`db users insert '{"name":"X"}'`);
    await run(`report create "T" --locale=en`);
    await run(`report table users --title=People`);
    await run(`report render --output=/o.html`);
    const html = await bash.readFile("/o.html");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Search...");
    expect(html).toContain("Generated:");
    expect(html).toMatch(/\d+ records</); // table footer text
    expect(html).not.toContain("Buscar...");
  });

  it("createReportPlugin({ locale: 'en' }) sets default", async () => {
    const enBash = new Bash({
      fs: new InMemoryFs({}),
      customCommands: createReportPlugin({ rootDir: "/data", locale: "en" }),
    });
    await enBash.exec(`report create "T"`);
    await enBash.exec(`report kpi "Users" 10`);
    await enBash.exec(`report render --output=/o.html`);
    const html = await enBash.readFile("/o.html");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Generated automatically");
  });

  it("--locale=en on report auto translates derived labels", async () => {
    // Need >=5 docs with 2 unique categories to trigger pie heuristic (2 < 5*0.5)
    await run(`db items insert '{"category":"A","amount":100}'`);
    await run(`db items insert '{"category":"B","amount":200}'`);
    await run(`db items insert '{"category":"A","amount":50}'`);
    await run(`db items insert '{"category":"B","amount":75}'`);
    await run(`db items insert '{"category":"A","amount":120}'`);
    await run(`report auto items --output=/auto.html --locale=en`);
    const html = await bash.readFile("/auto.html");
    expect(html).toContain("Total Records");
    expect(html).toContain("By category");
    expect(html).toContain("amount (average)");
    expect(html).toContain("amount (total)");
    expect(html).not.toContain("Total Registros");
    expect(html).not.toContain("Por category");
  });

  it("--locale=en on report invoice translates labels and status", async () => {
    const r = await run(`report invoice '${JSON.stringify({
      number: "INV-001", date: "2026-05-03",
      from: { name: "Acme", taxId: "ABC123" },
      to: { name: "Client" },
      items: [{ description: "consulting", quantity: 1, unitPrice: 100 }],
      status: "paid",
    })}' --output=/inv.html --locale=en`);
    expect(r.code).toBe(0);
    const html = await bash.readFile("/inv.html");
    expect(html).toContain("INVOICE");
    expect(html).toContain(">From<");
    expect(html).toContain(">To<");
    expect(html).toContain("Date:");
    expect(html).toContain(">Paid<");
    expect(html).toContain("Tax ID: ABC123");
    expect(html).not.toContain("FACTURA");
    expect(html).not.toContain(">De<");
    expect(html).not.toContain("Pagada");
    expect(html).not.toContain("RFC: ABC123");
  });

  it("--locale=en on report site translates nav and back link", async () => {
    await run(`db content insert '{"Title":"Hello","Body":"hi","Status":"Published"}'`);
    await run(`report site content --output=/sen --locale=en --title="Blog"`);
    const idx = await bash.readFile("/sen/index.html");
    const post = await bash.readFile("/sen/hello.html");
    expect(idx).toContain('<html lang="en">');
    expect(idx).toContain(">Home<");
    expect(post).toContain("Back to home");
    expect(post).not.toContain("Volver al inicio");
  });

  it("invoice JSON 'locale' field beats --locale flag", async () => {
    const r = await run(`report invoice '${JSON.stringify({
      number: "X", date: "2026", from: { name: "A" }, to: { name: "B" },
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
      locale: "en",
    })}' --output=/x.html --locale=es`);
    expect(r.code).toBe(0);
    const html = await bash.readFile("/x.html");
    expect(html).toContain("INVOICE");
    expect(html).not.toContain("FACTURA");
  });
});

// ── Issue #5: deterministic table IDs ────────────────────

describe("issue #5: deterministic table IDs", () => {
  const renderOnce = async () => {
    const b = new Bash({
      fs: new InMemoryFs({}),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await b.exec(`db users insert '{"name":"Ana","age":30}'`);
    await b.exec(`db users insert '{"name":"Bob","age":40}'`);
    await b.exec(`report create "T"`);
    await b.exec(`report table users --title=People`);
    await b.exec(`report render --output=/out.html`);
    return b.readFile("/out.html");
  };

  it("two renders produce identical HTML", async () => {
    const h1 = await renderOnce();
    const h2 = await renderOnce();
    expect(h1).toBe(h2);
  });

  it("table IDs are sequential (table_0, table_1, ...)", async () => {
    const b = new Bash({
      fs: new InMemoryFs({}),
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await b.exec(`db users insert '{"name":"A"}'`);
    await b.exec(`db users insert '{"name":"B"}'`);
    await b.exec(`report create "T"`);
    await b.exec(`report table users --title=T1`);
    await b.exec(`report table users --title=T2`);
    await b.exec(`report table users --title=T3`);
    await b.exec(`report render --output=/o.html`);
    const html = await b.readFile("/o.html");
    expect(html).toContain('id="table_0"');
    expect(html).toContain('id="table_1"');
    expect(html).toContain('id="table_2"');
    // No legacy random IDs
    expect(html).not.toMatch(/table_[a-z]{4,}/);
  });
});

// ── Issue #4: slug collisions in reportSite ──────────────

describe("issue #4: reportSite detects slug collisions", () => {
  it("rejects when two posts slugify to the same value", async () => {
    await run(`db content insert '{"Title":"Hello World","Body":"first","Status":"Published"}'`);
    await run(`db content insert '{"Title":"Hello, World!","Body":"second","Status":"Published"}'`);
    const r = await run(`report site content --output=/site`);
    expect(r.code).toBe(1);
    expect(r.err).toContain("slug collisions");
    expect(r.err).toContain("hello-world");
    expect(r.err).toContain("Hello World");
    expect(r.err).toContain("Hello, World!");
  });

  it("rejects when two posts share an explicit slug", async () => {
    await run(`db content insert '{"Title":"Post A","Body":"a","Status":"Published","slug":"shared"}'`);
    await run(`db content insert '{"Title":"Post B","Body":"b","Status":"Published","slug":"shared"}'`);
    const r = await run(`report site content --output=/site`);
    expect(r.code).toBe(1);
    expect(r.err).toContain("shared");
  });

  it("does not write any files when collision detected", async () => {
    await run(`db content insert '{"Title":"X","Body":"x","Status":"Published"}'`);
    await run(`db content insert '{"Title":"x","Body":"y","Status":"Published"}'`);
    await run(`report site content --output=/sitebad`);
    const fs = (bash as unknown as { fs: { exists(p: string): Promise<boolean> } }).fs;
    expect(await fs.exists("/sitebad/index.html")).toBe(false);
    expect(await fs.exists("/sitebad/x.html")).toBe(false);
  });

  it("succeeds when slugs are unique", async () => {
    await run(`db content insert '{"Title":"First Post","Body":"a","Status":"Published"}'`);
    await run(`db content insert '{"Title":"Second Post","Body":"b","Status":"Published"}'`);
    const r = await run(`report site content --output=/sitegood`);
    expect(r.code).toBe(0);
    const data = json<{ posts: string[] }>(r.out);
    expect(data.posts.sort()).toEqual(["first-post", "second-post"]);
  });
});

// ── Issue #3: reportQuick section content validation ─────

describe("issue #3: reportQuick validates section contents", () => {
  it("rejects chart without labels/values with clear message", async () => {
    const r = await run(`report quick '${JSON.stringify({
      title: "T", sections: [{ kind: "chart", type: "pie", title: "Bad" }],
    })}' --output=/o.html`);
    expect(r.code).toBe(2);
    expect(r.err.toLowerCase()).toContain("chart");
    expect(r.err).toContain("labels");
  });

  it("rejects chart with mismatched labels/values length", async () => {
    const r = await run(`report quick '${JSON.stringify({
      title: "T", sections: [{ kind: "chart", type: "pie", labels: ["a", "b"], values: [1] }],
    })}' --output=/o.html`);
    expect(r.code).toBe(2);
    expect(r.err).toContain("labels.length");
  });

  it("rejects kpi without label/value", async () => {
    const r = await run(`report quick '${JSON.stringify({
      title: "T", sections: [{ kind: "kpi" }],
    })}' --output=/o.html`);
    expect(r.code).toBe(2);
    expect(r.err.toLowerCase()).toContain("kpi");
  });

  it("rejects table without columns/rows", async () => {
    const r = await run(`report quick '${JSON.stringify({
      title: "T", sections: [{ kind: "table", title: "x" }],
    })}' --output=/o.html`);
    expect(r.code).toBe(2);
    expect(r.err.toLowerCase()).toContain("table");
  });

  it("rejects text without content string", async () => {
    const r = await run(`report quick '${JSON.stringify({
      title: "T", sections: [{ kind: "text" }],
    })}' --output=/o.html`);
    expect(r.code).toBe(2);
    expect(r.err.toLowerCase()).toContain("text");
  });

  it("accepts valid spec with all four kinds", async () => {
    const r = await run(`report quick '${JSON.stringify({
      title: "Mixed",
      sections: [
        { kind: "kpi", label: "K", value: 1 },
        { kind: "chart", type: "pie", title: "C", labels: ["a"], values: [1] },
        { kind: "table", title: "T", columns: ["x"], rows: [{ x: 1 }] },
        { kind: "text", content: "hi" },
      ],
    })}' --output=/mixed.html`);
    expect(r.code).toBe(0);
  });
});

// ── Issue #2: report state namespaced by --id ─────────────

describe("issue #2: multiple reports via --id", () => {
  it("two parallel reports do not interfere", async () => {
    await run(`report create "Dept A" --id=a`);
    await run(`report create "Dept B" --id=b`);
    await run(`report kpi "Users" 100 --id=a`);
    await run(`report kpi "Users" 200 --id=b`);
    await run(`report kpi "Revenue" 5000 --id=a`);

    const sa = json<{ breakdown: { kpis: number }; title: string }>(
      (await run(`report status --id=a`)).out
    );
    const sb = json<{ breakdown: { kpis: number }; title: string }>(
      (await run(`report status --id=b`)).out
    );
    expect(sa.title).toBe("Dept A");
    expect(sb.title).toBe("Dept B");
    expect(sa.breakdown.kpis).toBe(2);
    expect(sb.breakdown.kpis).toBe(1);
  });

  it("each --id renders independently", async () => {
    await run(`report create "A" --id=a`);
    await run(`report kpi "x" 1 --id=a`);
    await run(`report create "B" --id=b`);
    await run(`report kpi "y" 2 --id=b`);

    await run(`report render --id=a --output=/a.html`);
    await run(`report render --id=b --output=/b.html`);

    const ha = await bash.readFile("/a.html");
    const hb = await bash.readFile("/b.html");
    expect(ha).toContain("A");
    expect(ha).toContain(">x<");
    expect(hb).toContain("B");
    expect(hb).toContain(">y<");
    expect(ha).not.toContain(">y<");
    expect(hb).not.toContain(">x<");
  });

  it("backwards-compat: omitting --id uses 'default' bucket", async () => {
    await run(`report create "Legacy"`);
    await run(`report kpi "K" 1`);
    const s = json<{ active: boolean; title: string; id?: string }>(
      (await run(`report status`)).out
    );
    expect(s.active).toBe(true);
    expect(s.title).toBe("Legacy");
    expect(s.id).toBe("default");
  });

  it("status without --id when other ids exist hints them", async () => {
    await run(`report create "X" --id=ns1`);
    await run(`report create "Y" --id=ns2`);
    const s = json<{ active: boolean; ids?: string[] }>((await run(`report status`)).out);
    expect(s.active).toBe(false);
    expect(s.ids).toEqual(expect.arrayContaining(["ns1", "ns2"]));
  });

  it("kpi/chart/table/text/render with unknown --id all fail with helpful message", async () => {
    const k = await run(`report kpi "x" 1 --id=missing`);
    expect(k.code).toBe(2);
    expect(k.err).toContain("missing");
    const r = await run(`report render --id=missing`);
    expect(r.code).toBe(2);
    expect(r.err).toContain("missing");
  });
});

// ── Issue #1: writeFile error handling ────────────────────

describe("issue #1: render/invoice writeFile error handling", () => {
  it("render to nested non-existent dir succeeds (parent dirs auto-created)", async () => {
    await run(`report create "T"`);
    await run(`report kpi "X" 1`);
    const r = await run(`report render --output=/deep/nested/missing/out.html`);
    expect(r.code).toBe(0);
    const html = await bash.readFile("/deep/nested/missing/out.html");
    expect(html).toContain("T");
  });

  it("render does NOT leave .keep artifact behind", async () => {
    await run(`report create "T"`);
    await run(`report kpi "X" 1`);
    await run(`report render --output=/nodir/out.html`);
    const fs = (bash as unknown as { fs: { exists(p: string): Promise<boolean> } }).fs;
    expect(await fs.exists("/nodir/.keep")).toBe(false);
    expect(await fs.exists("/nodir/out.html")).toBe(true);
  });

  it("render returns proper fail() when fs throws and cannot recover", async () => {
    // Mock a read-only fs that always throws
    const failingFs = new InMemoryFs({});
    const orig = failingFs.writeFile.bind(failingFs);
    let callCount = 0;
    failingFs.writeFile = async (...args: Parameters<typeof orig>) => {
      callCount++;
      throw new Error("EROFS: read-only filesystem");
    };
    failingFs.mkdir = async () => { throw new Error("EROFS"); };
    const failBash = new Bash({
      fs: failingFs,
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    await failBash.exec(`report create "T"`);
    await failBash.exec(`report kpi "X" 1`);
    const r = await failBash.exec(`report render --output=/out.html`);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("cannot write");
    expect(r.stderr).toContain("EROFS");
  });

  it("invoice to nested dir succeeds", async () => {
    const r = await run(`report invoice '${JSON.stringify({
      number: "INV-001",
      date: "2026-05-03",
      from: { name: "A" },
      to: { name: "B" },
      items: [{ description: "x", quantity: 1, unitPrice: 100 }],
    })}' --output=/deep/inv/INV-001.html`);
    expect(r.code).toBe(0);
    const html = await bash.readFile("/deep/inv/INV-001.html");
    expect(html).toContain("INV-001");
  });

  it("invoice returns fail() when fs throws", async () => {
    const failingFs = new InMemoryFs({});
    failingFs.writeFile = async () => { throw new Error("ENOSPC: no space"); };
    failingFs.mkdir = async () => { throw new Error("ENOSPC"); };
    const failBash = new Bash({
      fs: failingFs,
      customCommands: createReportPlugin({ rootDir: "/data" }),
    });
    const r = await failBash.exec(`report invoice '${JSON.stringify({
      number: "X", date: "2026", from: { name: "A" }, to: { name: "B" },
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
    })}' --output=/x.html`);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("cannot write");
  });
});
