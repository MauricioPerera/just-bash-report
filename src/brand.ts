/**
 * BRAND.md / DESIGN.md parser.
 *
 * Format: YAML front matter (between ---) with design tokens,
 * followed by optional markdown prose (ignored by the parser).
 *
 * Compatible with google-labs-code/design.md token format.
 */

export interface BrandTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    danger: string;
    background: string;
    card: string;
    text: string;
    muted: string;
    border?: string;
    [key: string]: string | undefined;
  };
  typography?: {
    heading?: { fontFamily?: string; fontWeight?: number | string };
    body?: { fontFamily?: string; fontWeight?: number | string };
  };
  logo?: string;
  rounded?: string;
  chartColors?: string[];
}

const DEFAULTS: BrandTokens = {
  colors: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    accent: "#f59e0b",
    success: "#10b981",
    danger: "#ef4444",
    background: "#f8fafc",
    card: "#ffffff",
    text: "#1e293b",
    muted: "#64748b",
    border: "#e2e8f0",
  },
};

/**
 * Minimal YAML front matter parser.
 * Handles flat and one-level nested objects. No arrays, no multiline strings.
 * Good enough for design tokens without pulling a full YAML dep.
 */
export function parseBrandFile(content: string): BrandTokens {
  // Extract YAML front matter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return { ...DEFAULTS };

  const yaml = fmMatch[1];
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  // Two-pass approach:
  // 1. Parse all lines into (indent, key, value|null) tuples
  // 2. Build nested structure

  const parsed: Array<{ indent: number; key?: string; value?: string; isSeq?: boolean; seqValue?: string }> = [];

  for (const raw of lines) {
    const trimEnd = raw.trimEnd();
    if (trimEnd === "" || trimEnd.trimStart().startsWith("#")) continue;
    const indent = trimEnd.length - trimEnd.trimStart().length;
    const trimmed = trimEnd.trimStart();

    // Sequence item: - value
    const seqMatch = trimmed.match(/^-\s+(.+)$/);
    if (seqMatch) {
      parsed.push({ indent, isSeq: true, seqValue: seqMatch[1] });
      continue;
    }

    // Key: value (allow no space after colon for compat)
    const kvMatch = trimmed.match(/^(\S+):\s*(.+)$/);
    if (kvMatch) {
      parsed.push({ indent, key: kvMatch[1], value: kvMatch[2] });
      continue;
    }

    // Key: (no value — object or array follows)
    const objMatch = trimmed.match(/^(\S+):\s*$/);
    if (objMatch) {
      parsed.push({ indent, key: objMatch[1] });
    }
  }

  // Build structure
  let l1Obj: Record<string, unknown> | null = null;
  let l1Arr: unknown[] | null = null;
  let l2Obj: Record<string, unknown> | null = null;

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];

    if (p.indent === 0 && p.key) {
      // Flush
      l1Obj = null; l1Arr = null; l2Obj = null;
      if (p.value !== undefined) {
        result[p.key] = parseValue(p.value);
      } else {
        // Peek: is the next line a sequence item?
        const next = parsed[i + 1];
        if (next && next.isSeq) {
          l1Arr = [];
          result[p.key] = l1Arr;
        } else {
          l1Obj = {};
          result[p.key] = l1Obj;
        }
      }
    } else if (p.indent === 0 && p.isSeq && l1Arr) {
      l1Arr.push(parseValue(p.seqValue!));
    } else if (p.indent >= 2 && p.indent < 4) {
      if (p.isSeq && l1Arr) {
        l1Arr.push(parseValue(p.seqValue!));
      } else if (p.key && l1Obj) {
        l2Obj = null;
        if (p.value !== undefined) {
          l1Obj[p.key] = parseValue(p.value);
        } else {
          // Peek for array
          const next = parsed[i + 1];
          if (next && next.isSeq && next.indent >= 4) {
            const arr: unknown[] = [];
            l1Obj[p.key] = arr;
            // Consume sequence items
            while (i + 1 < parsed.length && parsed[i + 1].isSeq && parsed[i + 1].indent >= 4) {
              i++;
              arr.push(parseValue(parsed[i].seqValue!));
            }
          } else {
            l2Obj = {};
            l1Obj[p.key] = l2Obj;
          }
        }
      }
    } else if (p.indent >= 4 && p.key && l2Obj) {
      if (p.value !== undefined) {
        l2Obj[p.key] = parseValue(p.value);
      }
    }
  }

  return mergeBrand(result);
}

function parseValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  // Remove quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;
  return trimmed;
}

function mergeBrand(raw: Record<string, unknown>): BrandTokens {
  const tokens: BrandTokens = {
    colors: { ...DEFAULTS.colors },
  };

  // Merge colors
  if (raw.colors && typeof raw.colors === "object") {
    Object.assign(tokens.colors, raw.colors);
  }

  // Typography
  if (raw.typography && typeof raw.typography === "object") {
    tokens.typography = raw.typography as BrandTokens["typography"];
  }

  // Logo
  if (typeof raw.logo === "string") tokens.logo = raw.logo;

  // Rounded
  if (typeof raw.rounded === "string") tokens.rounded = raw.rounded;

  // Chart colors — if primary/secondary/accent defined, build palette from them
  if (raw.chartColors && Array.isArray(raw.chartColors)) {
    tokens.chartColors = raw.chartColors as string[];
  } else {
    tokens.chartColors = [
      tokens.colors.primary,
      tokens.colors.secondary ?? tokens.colors.primary,
      tokens.colors.accent ?? "#f59e0b",
      tokens.colors.success ?? "#10b981",
      tokens.colors.danger ?? "#ef4444",
      "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
      "#84cc16", "#0ea5e9", "#a855f7", "#22c55e", "#e11d48",
    ];
  }

  return tokens;
}

/** Generate CSS custom properties from brand tokens */
export function brandToCssVars(tokens: BrandTokens): string {
  const vars: string[] = [];

  vars.push(`--bg:${tokens.colors.background}`);
  vars.push(`--card:${tokens.colors.card}`);
  vars.push(`--text:${tokens.colors.text}`);
  vars.push(`--muted:${tokens.colors.muted}`);
  vars.push(`--border:${tokens.colors.border ?? "#e2e8f0"}`);
  vars.push(`--accent:${tokens.colors.primary}`);
  vars.push(`--success:${tokens.colors.success}`);
  vars.push(`--danger:${tokens.colors.danger}`);

  if (tokens.rounded) vars.push(`--radius:${tokens.rounded}`);

  if (tokens.typography?.heading?.fontFamily) {
    vars.push(`--font-heading:${tokens.typography.heading.fontFamily}`);
  }
  if (tokens.typography?.body?.fontFamily) {
    vars.push(`--font-body:${tokens.typography.body.fontFamily}`);
  }

  return vars.join(";");
}
