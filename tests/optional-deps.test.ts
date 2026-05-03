/**
 * Tests for the optional peer-dep model (v2.0.0).
 *
 * These run in their own file so the lazy-loaded _runtime cache inside
 * src/index.ts starts fresh.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Module from "node:module";

// Save the original loader so we can restore it between tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalLoad = (Module as any)._load;

function patchMissing(spec: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._load = function (request: string, ...rest: unknown[]) {
    if (request === spec) {
      const err = new Error(`Cannot find module '${spec}'`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code = "MODULE_NOT_FOUND";
      throw err;
    }
    return originalLoad.call(this, request, ...rest);
  };
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._load = originalLoad;
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Module as any)._load = originalLoad;
});

describe("v2.0.0: pure generators import without optional peer deps", () => {
  it("package entry can be imported without invoking the lazy loader", async () => {
    // No patching: just verify the entry imports cleanly.
    const mod = await import("../src/index.js");
    expect(typeof mod.generateHtml).toBe("function");
    expect(typeof mod.generateInvoiceHtml).toBe("function");
    expect(typeof mod.generateIndex).toBe("function");
    expect(typeof mod.parseBrandFile).toBe("function");
    expect(typeof mod.mdToHtml).toBe("function");
    // createReportPlugin is exported but not yet called → no runtime load.
    expect(typeof mod.createReportPlugin).toBe("function");
  });

  it("all generate* functions work without ever loading just-bash", async () => {
    patchMissing("just-bash");
    const mod = await import("../src/index.js");
    // Pure functions: should produce HTML even when just-bash is unreachable.
    const html = mod.generateHtml({
      title: "T",
      generated: "2026-05-03",
      sections: [{ kind: "kpi", label: "X", value: 1 }],
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>T</title>");
  });

  it("generateInvoiceHtml works without loading just-bash", async () => {
    patchMissing("just-bash");
    const { generateInvoiceHtml } = await import("../src/index.js");
    const html = generateInvoiceHtml({
      number: "INV-1",
      date: "2026-01-01",
      from: { name: "A" },
      to: { name: "B" },
      items: [{ description: "x", quantity: 1, unitPrice: 10 }],
    });
    expect(html).toContain("INV-1");
  });
});

describe("v2.0.0: createReportPlugin throws helpful error when peer deps missing", () => {
  it("missing 'just-bash' produces actionable error", async () => {
    patchMissing("just-bash");
    const mod = await import("../src/index.js");
    expect(() => mod.createReportPlugin()).toThrow(/just-bash/);
    expect(() => mod.createReportPlugin()).toThrow(/npm install just-bash just-bash-data/);
    expect(() => mod.createReportPlugin()).toThrow(/pure HTML generators/);
  });

  it("missing 'just-bash-data' produces actionable error", async () => {
    patchMissing("just-bash-data");
    const mod = await import("../src/index.js");
    expect(() => mod.createReportPlugin()).toThrow(/just-bash-data/);
    expect(() => mod.createReportPlugin()).toThrow(/npm install just-bash-data/);
  });

  it("error mentions the underlying module-not-found cause", async () => {
    patchMissing("just-bash");
    const mod = await import("../src/index.js");
    expect(() => mod.createReportPlugin()).toThrow(/Cannot find module/);
  });
});
