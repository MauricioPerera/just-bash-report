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
