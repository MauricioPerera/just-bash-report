import { Command } from 'just-bash';
import { PluginOptions } from 'just-bash-data';

/**
 * BRAND.md / DESIGN.md parser.
 *
 * Format: YAML front matter (between ---) with design tokens,
 * followed by optional markdown prose (ignored by the parser).
 *
 * Compatible with google-labs-code/design.md token format.
 */
interface BrandTokens {
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
        heading?: {
            fontFamily?: string;
            fontWeight?: number | string;
        };
        body?: {
            fontFamily?: string;
            fontWeight?: number | string;
        };
    };
    logo?: string;
    rounded?: string;
    chartColors?: string[];
}

/** Generates the self-contained HTML dashboard. */

interface KpiSection {
    kind: "kpi";
    label: string;
    value: string | number;
    trend?: string;
    color?: string;
}
interface ChartSection {
    kind: "chart";
    type: "pie" | "bar" | "line" | "doughnut";
    title: string;
    labels: string[];
    values: number[];
    colors?: string[];
}
interface TableSection {
    kind: "table";
    title: string;
    columns: string[];
    rows: Array<Record<string, unknown>>;
}
interface TextSection {
    kind: "text";
    content: string;
}
type Section = KpiSection | ChartSection | TableSection | TextSection;
interface ReportData {
    title: string;
    subtitle?: string;
    logo?: string;
    generated: string;
    sections: Section[];
    brand?: BrandTokens;
}

/**
 * Invoice HTML generator.
 * Self-contained HTML, print-ready, uses BRAND.md tokens.
 */

interface InvoiceParty {
    name: string;
    address?: string;
    city?: string;
    taxId?: string;
    email?: string;
    phone?: string;
}
interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    tax?: number;
}
interface InvoiceData {
    number: string;
    date: string;
    dueDate?: string;
    from: InvoiceParty;
    to: InvoiceParty;
    items: InvoiceItem[];
    currency?: string;
    taxLabel?: string;
    taxRate?: number;
    notes?: string;
    paymentInfo?: string;
    status?: "draft" | "sent" | "paid" | "overdue";
    brand?: BrandTokens;
}

/**
 * Static site generator.
 * Reads posts from a db collection (content template), generates
 * self-contained HTML pages with index, individual posts, and RSS.
 */

interface SitePost {
    _id: string;
    Title: string;
    Body: string;
    Author?: string;
    Status: string;
    Category?: string;
    Tags?: string[];
    PublishedAt?: string;
    URL?: string;
    slug?: string;
    Number?: number;
    CreatedAt?: string;
}
interface SiteConfig {
    title: string;
    description?: string;
    baseUrl?: string;
    postsPerPage?: number;
    brand?: BrandTokens;
}

interface ReportOptions extends PluginOptions {
}
declare function createReportPlugin(opts?: ReportOptions): Command[];

export { type BrandTokens, type ChartSection, type InvoiceData, type InvoiceItem, type InvoiceParty, type KpiSection, type ReportData, type ReportOptions, type Section, type SiteConfig, type SitePost, type TableSection, type TextSection, createReportPlugin };
