# Changelog

All notable changes to this package are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-05-03

### Changed (BREAKING for plugin users)
- `just-bash` and `just-bash-data` moved from `dependencies` / `peerDependencies`
  to `peerDependencies` with `peerDependenciesMeta.optional`. Plugin users now
  need to install both explicitly:

  ```bash
  npm install just-bash-report just-bash just-bash-data
  ```

  Pure-generator users (only calling `generateHtml`, `generateInvoiceHtml`,
  `generateIndex`, `generatePostPage`, `generateRss`, `parseBrandFile`,
  `mdToHtml`, `getStrings`) install only `just-bash-report` and skip the
  ~3 transitive deps that previously came along.

### Added
- Lazy runtime loader: `createReportPlugin()` defers loading of the optional
  peer deps to first call via `createRequire`. The package can be imported
  and the pure generators used without the peers installed.
- Helpful error when `createReportPlugin()` is called without the peers:
  the message names the missing module, gives the exact `npm install`
  command, and points at the pure-generator path as an alternative.
- Test file `tests/optional-deps.test.ts` (6 tests) verifying that pure
  generators work with mocked-missing peers and that the error path
  produces an actionable message.

### Internal
- `tsup.config.ts` marks `just-bash` and `just-bash-data` as `external` so
  they are never bundled into `dist/`.
- Top-level imports of those modules converted to type-only.

## [1.3.0] - 2026-05-03

### Added
- Pure HTML generators (`generateHtml`, `generateInvoiceHtml`, `generateIndex`,
  `generatePostPage`, `generateRss`, `parseBrandFile`, `brandToCssVars`,
  `mdToHtml`, `getStrings`) re-exported from the package entry. Use the
  package as a pure HTML library without `just-bash` (issue #10).
- `--id` flag on every `report` subcommand to namespace report state. Multiple
  concurrent reports can now be built within the same `Bash` instance without
  interfering. Backwards-compatible: omitting `--id` uses the `"default"`
  bucket (issue #2).
- `locale` option for rendered output. Default remains `"es"` (preserves v1.x
  behavior). Override per-call with `--locale=en`, per-plugin with
  `createReportPlugin({ locale: "en" })`, or per-invoice with the `locale`
  field on the JSON spec. Translates dashboard, invoice, and site strings
  including the `<html lang>` attribute and the RFC/Tax ID label (issue #6).
- `--offline` flag honored on `report invoice` and `report site` (previously
  only `report create` for dashboards). When set with custom brand fonts,
  the Google Fonts `<link>` is replaced with an HTML comment and pages fall
  back to system fonts (issue #7).
- `CHANGELOG.md` following Keep a Changelog (issue #9).
- `release.yml` workflow publishes to npm with provenance on `v*` tags
  (issue #12).
- `pages.yml` workflow deploys live demos to
  https://mauricioperera.github.io/just-bash-report/ (issue #12).
- New keywords on `package.json`: `invoice`, `html-invoice`,
  `static-site-generator`, `ssg`, `rss` (issue #11).

### Fixed
- `reportRender` and `reportInvoice` no longer use the `.keep` mkdir hack with
  an unguarded second `writeFile`. Replaced with a `safeWrite()` helper that
  tries direct write, falls back to `mkdir(recursive)` + retry, and returns
  a structured `fail(1)` message when the FS is read-only or out of space —
  no uncaught exceptions reach the caller (issue #1).
- `reportQuick` now validates section contents per kind (chart needs
  `labels`+`values` of equal length, kpi needs `label`+`value`, table needs
  `columns`+`rows`, text needs `content`). Previously only checked `kind`
  and crashed deep inside `generateHtml` with `TypeError`s (issue #3).
- `reportSite` detects slug collisions (e.g. titles `"Hello World"` and
  `"Hello, World!"` both slug to `hello-world`) before writing any file and
  returns `fail(1)` listing every colliding slug and the titles that produced
  it. Previously the second post silently overwrote the first (issue #4).
- `reportSite` captures `writeFile` errors mid-loop and rolls back any files
  already written. Previously a partial failure left a half-published site
  (some posts present, others missing, RSS pointing to gaps) and propagated
  as an uncaught exception (issue #8).
- Table IDs in the dashboard HTML are now sequential (`table_0`, `table_1`)
  instead of `Math.random()`. Two renders of the same input produce
  byte-identical HTML, restoring diffability and HTTP/CDN cacheability
  (issue #5).

### Changed
- `reportSite` factored the slugify expression (previously duplicated three
  times) into a single local `slugFor()` helper.
- Description unified across `package.json`, GitHub repo, and README to
  surface invoice and site generators on first impression (issue #11).
- README rewritten with new "Use without just-bash" section, `--id`,
  `--locale`, `--offline` documentation, updated concurrency model.

### Tests
- Test suite grew from 25 to 67 tests covering all twelve fixes.

## [1.2.1] - 2026-05-02

### Fixed
- `--offline` now actually inlines Chart.js (~208 KB) into the HTML instead
  of just stripping the CDN `<script>` tag. Previously offline reports
  loaded but charts never rendered without internet.
- `BRAND.md` embed script (`scripts/embed-chartjs.cjs`) uses
  `JSON.stringify` instead of template literal escaping (the previous form
  corrupted the JS source for some Chart.js builds).

### Added
- README documents `--offline`, CDN dependency caveat, site field mapping,
  and the concurrency model.
- Test verifies offline HTML is >200 KB and contains chart calls.

## [1.2.0] - 2026-05-02

### Added
- `--offline` flag on `report create` to omit Chart.js CDN and Google Fonts
  for self-contained HTML.
- BRAND.md `chartColors` as YAML sequence (was a dead branch before).
- `report site` field mapping: `--field-title`, `--field-body`,
  `--field-status`, `--field-author`, `--field-category`, `--field-tags`,
  `--field-date`, `--field-slug` allow using collections with non-standard
  field names.
- `report site` response: `pages` renamed to `htmlPages`, added `feeds` count.

### Fixed
- BRAND.md parser: two-pass approach with peek-ahead for arrays vs objects,
  supports 3-level nesting and YAML sequences at any level.
- `kvMatch` regex uses `\s*` instead of `\s+` for compat with `key:#value`
  edge case.

### Changed
- Tests grew from 20 to 25 covering the new flags and BRAND.md edge cases.

## [1.1.0] - 2026-05-02

### Added
- 20 vitest tests covering all commands, brand theming, edge cases.
- README with full command reference and examples.
- LICENSE, GitHub Actions CI, `.gitignore`.
- Documented exported types.

### Fixed
- Escape `</script>` in chart JSON (XSS prevention).
- Unify markdown parsers into shared `md.ts`.
- Validate section kinds in `report quick`.
- BRAND.md parser supports 3-level nesting (`typography.heading.fontFamily`).

## [1.0.0] - 2026-05-02

### Added
- Initial release.
- `report create / kpi / chart / table / text / render` step-by-step builder.
- `report auto` — auto-generate dashboard from any `db` collection.
- `report invoice` — professional invoices with line items, tax, totals.
- `report site` — static blog/CMS from a `content` collection with index + RSS.
- `--brand=BRAND.md` — apply company identity (colors, fonts, logo),
  compatible with `google-labs-code/design.md` token format.
- Chart.js charts (pie, bar, line, doughnut).
- Sortable / searchable tables.
- Responsive + print-friendly CSS.
- Markdown rendering in text sections and blog posts.
