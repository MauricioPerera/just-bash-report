/**
 * Static site generator.
 * Reads posts from a db collection (content template), generates
 * self-contained HTML pages with index, individual posts, and RSS.
 */

import { type BrandTokens, brandToCssVars } from "./brand.js";
import { mdToHtml, escHtml } from "./md.js";
import { getStrings, type Locale } from "./i18n.js";

export interface SitePost {
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

export interface SiteConfig {
  title: string;
  description?: string;
  baseUrl?: string;
  postsPerPage?: number;
  brand?: BrandTokens;
  locale?: Locale;
  /** Skip Google Fonts CDN — falls back to system fonts when set with custom brand fonts */
  offline?: boolean;
}

// escHtml and mdToHtml imported from ./md.ts

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function siteHead(title: string, brand?: BrandTokens, locale?: Locale, offline?: boolean): string {
  const lang = getStrings(locale).htmlLang;
  const cssVars = brand ? brandToCssVars(brand) : "";
  const logoUrl = brand?.logo;
  const headingFont = brand?.typography?.heading?.fontFamily;
  const bodyFont = brand?.typography?.body?.fontFamily;

  const fontsToLoad: string[] = [];
  for (const f of [headingFont, bodyFont]) {
    if (f && !f.includes("system") && !f.includes("sans-serif")) {
      const family = f.split(",")[0].trim().replace(/'/g, "");
      if (!fontsToLoad.includes(family)) fontsToLoad.push(family);
    }
  }
  const fontLink = offline
    ? (fontsToLoad.length > 0
        ? `<!-- offline mode: ${fontsToLoad.length} custom font(s) skipped, falling back to system fonts -->`
        : "")
    : (fontsToLoad.length > 0
        ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&")}&display=swap">`
        : "");

  const fontBody = bodyFont ?? "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const fontHead = headingFont ?? "inherit";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
${fontLink}
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f8fafc;--card:#fff;--text:#1e293b;--muted:#64748b;--border:#e2e8f0;--accent:#6366f1;--radius:12px${cssVars ? ";" + cssVars : ""}}
body{font-family:${fontBody};background:var(--bg);color:var(--text);line-height:1.7}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.container{max-width:800px;margin:0 auto;padding:24px}
.site-header{text-align:center;padding:40px 0 32px;border-bottom:1px solid var(--border);margin-bottom:32px}
.site-logo{max-height:48px;margin-bottom:12px}
.site-title{font-size:28px;font-weight:700;font-family:${fontHead}}
.site-desc{font-size:15px;color:var(--muted);margin-top:4px}
.site-nav{margin-top:12px;display:flex;gap:16px;justify-content:center;font-size:14px}
.post-card{background:var(--card);border-radius:var(--radius);padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);transition:box-shadow 0.2s}
.post-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.1)}
.post-card h2{font-size:20px;font-family:${fontHead};margin-bottom:6px}
.post-card h2 a{color:var(--text)}
.post-meta{font-size:13px;color:var(--muted);margin-bottom:8px;display:flex;gap:12px;flex-wrap:wrap}
.post-excerpt{font-size:15px;color:#475569}
.post-tags{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.tag{font-size:12px;padding:2px 10px;border-radius:12px;background:color-mix(in srgb,var(--accent) 10%,white);color:var(--accent);font-weight:500}
.category{font-size:12px;padding:2px 10px;border-radius:12px;background:color-mix(in srgb,var(--accent) 20%,white);color:var(--accent);font-weight:600}
article{background:var(--card);border-radius:var(--radius);padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:24px}
article h1{font-size:28px;font-family:${fontHead};margin-bottom:8px}
article .post-meta{margin-bottom:24px}
article .post-body{font-size:16px}
article .post-body h1,article .post-body h2,article .post-body h3{margin:24px 0 8px;font-family:${fontHead}}
article .post-body p{margin:12px 0}
article .post-body ul{margin:12px 0 12px 24px}
article .post-body li{margin:4px 0}
article .post-body code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:14px}
.back-link{display:inline-block;margin-bottom:20px;font-size:14px}
.footer{text-align:center;padding:24px 0;font-size:12px;color:var(--muted);border-top:1px solid var(--border);margin-top:32px}
@media print{body{background:#fff}.container{max-width:none}}
@media(max-width:640px){.container{padding:12px}article{padding:20px}}
</style>
</head>`;
}

function siteHeader(config: SiteConfig): string {
  const s = getStrings(config.locale);
  const logoHtml = config.brand?.logo
    ? `<img src="${escHtml(config.brand.logo)}" alt="Logo" class="site-logo"><br>`
    : "";
  return `<div class="site-header">
  ${logoHtml}
  <div class="site-title">${escHtml(config.title)}</div>
  ${config.description ? `<div class="site-desc">${escHtml(config.description)}</div>` : ""}
  <nav class="site-nav">
    <a href="index.html">${escHtml(s.home)}</a>
    <a href="rss.xml">RSS</a>
  </nav>
</div>`;
}

export function generateIndex(posts: SitePost[], config: SiteConfig): string {
  const s = getStrings(config.locale);
  const header = siteHeader(config);

  const postCards = posts.map(post => {
    const slug = post.slug ?? slugify(post.Title);
    const excerpt = (post.Body ?? "").slice(0, 200).replace(/[#*`\n]/g, " ").trim();
    const tags = (post.Tags ?? []).map(t => `<span class="tag">${escHtml(t)}</span>`).join("");
    const catHtml = post.Category ? `<span class="category">${escHtml(post.Category)}</span>` : "";

    return `<div class="post-card">
  <h2><a href="${slug}.html">${escHtml(post.Title)}</a></h2>
  <div class="post-meta">
    ${post.Author ? `<span>${escHtml(s.byAuthor(post.Author))}</span>` : ""}
    ${post.PublishedAt ? `<span>${escHtml(post.PublishedAt)}</span>` : ""}
    ${catHtml}
  </div>
  <div class="post-excerpt">${escHtml(excerpt)}${excerpt.length >= 200 ? "..." : ""}</div>
  ${tags ? `<div class="post-tags">${tags}</div>` : ""}
</div>`;
  }).join("\n");

  return `${siteHead(config.title, config.brand, config.locale, config.offline)}
<body>
<div class="container">
  ${header}
  ${postCards}
  <div class="footer">${escHtml(config.title)} &middot; ${escHtml(s.generatedFooter)}</div>
</div>
</body>
</html>`;
}

export function generatePostPage(post: SitePost, config: SiteConfig): string {
  const s = getStrings(config.locale);
  const tags = (post.Tags ?? []).map(t => `<span class="tag">${escHtml(t)}</span>`).join("");

  return `${siteHead(`${post.Title} — ${config.title}`, config.brand, config.locale, config.offline)}
<body>
<div class="container">
  ${siteHeader(config)}
  <a href="index.html" class="back-link">${escHtml(s.backToHome)}</a>
  <article>
    <h1>${escHtml(post.Title)}</h1>
    <div class="post-meta">
      ${post.Author ? `<span>${escHtml(s.byAuthor(post.Author))}</span>` : ""}
      ${post.PublishedAt ? `<span>${escHtml(post.PublishedAt)}</span>` : ""}
      ${post.Category ? `<span class="category">${escHtml(post.Category)}</span>` : ""}
    </div>
    ${tags ? `<div class="post-tags" style="margin-bottom:24px">${tags}</div>` : ""}
    <div class="post-body">${mdToHtml(post.Body ?? "")}</div>
  </article>
  <div class="footer">${escHtml(config.title)} &middot; ${escHtml(s.generatedFooter)}</div>
</div>
</body>
</html>`;
}

export function generateRss(posts: SitePost[], config: SiteConfig): string {
  const baseUrl = config.baseUrl ?? "";
  const items = posts.slice(0, 20).map(post => {
    const slug = post.slug ?? slugify(post.Title);
    const excerpt = (post.Body ?? "").slice(0, 300).replace(/[#*`\n]/g, " ").trim();
    return `  <item>
    <title>${escHtml(post.Title)}</title>
    <link>${escHtml(baseUrl)}/${slug}.html</link>
    <description>${escHtml(excerpt)}</description>
    ${post.PublishedAt ? `<pubDate>${new Date(post.PublishedAt).toUTCString()}</pubDate>` : ""}
    ${post.Author ? `<author>${escHtml(post.Author)}</author>` : ""}
  </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escHtml(config.title)}</title>
  ${config.description ? `<description>${escHtml(config.description)}</description>` : ""}
  <link>${escHtml(baseUrl)}</link>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;
}
