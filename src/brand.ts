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
  let currentObj: Record<string, unknown> | null = null;
  let currentKey = "";

  for (const line of yaml.split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Nested key (indented)
    const nestedMatch = trimmed.match(/^  (\S+):\s*(.+)$/);
    if (nestedMatch && currentObj) {
      currentObj[nestedMatch[1]] = parseValue(nestedMatch[2]);
      continue;
    }

    // Top-level key with value
    const kvMatch = trimmed.match(/^(\S+):\s*(.+)$/);
    if (kvMatch) {
      currentObj = null;
      const val = parseValue(kvMatch[2]);
      result[kvMatch[1]] = val;
      continue;
    }

    // Top-level key without value (object start)
    const objMatch = trimmed.match(/^(\S+):\s*$/);
    if (objMatch) {
      currentKey = objMatch[1];
      currentObj = {};
      result[currentKey] = currentObj;
      continue;
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
