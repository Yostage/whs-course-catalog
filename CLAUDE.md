# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (hot reload)
npm run build     # production build → dist/
npm run preview   # serve the dist/ build locally
```

To re-scrape the catalog from the source HTML:
```bash
# First download the HTML (saved to /tmp/catalog_raw.html by convention):
curl -s "https://woodinville.nsd.org/counseling/course-catalog-2023-24" > /tmp/catalog_raw.html

# Then regenerate courses.json:
python3 parse_catalog.py > courses.json
# stderr shows: "Total courses parsed: 167"

# Then rebuild the app:
npm run build
```

`beautifulsoup4` is required for the parser: `pip install beautifulsoup4`

## Architecture

This is a two-part project: a Python scraper/parser and a Vite+React SPA.

### Data pipeline

`parse_catalog.py` → `courses.json` → imported at build time into the React bundle

- **`parse_catalog.py`** downloads and parses the WHS course catalog HTML. It identifies course sections by `<h2 class="fsElementTitle">` headings, maps them to subjects via `SUBJECT_MAP`, then extracts individual course entries from `<p>` blocks within each section. The catalog HTML has several structural quirks handled explicitly:
  - Some sections (Math, Science) use `<br/>`-separated inline fields with label variants (`Grade:` vs `Grades:`, `Length / Credit:` vs `Length/Credit:`) and colon-outside-bold patterns
  - World Languages and some other sections group multiple course headers before a single shared metadata block — detected via consecutive header paragraphs
  - A few sections (mentor courses) pack multiple courses into one `<p>` separated by `<br/>` — expanded by `expand_br_separated_headers()`
  - World Languages appear under CTE diploma category at WHS but have `CTE` discarded from their tracks

- **`courses.json`** is the structured artifact (~167 courses). Each entry has: `code`, `name`, `subject`, `sub_subject`, `credits`, `duration`, `grades` (list of ints), `prerequisites`, `diploma_category`, `fees`, `notes`, `description`, `tracks` (derived tags).

### React app

**`src/CourseCatalog.jsx`** is the entire UI — a single self-contained component with no routing or additional dependencies. It imports `courses.json` directly (bundled at build time, no fetch needed).

At module load it normalises the JSON schema into a flat `COURSES` array:
- `department` = `sub_subject || subject`, except English sub-subjects are collapsed to `"English"` (grade filter handles level)
- `ap` is derived from `name.startsWith("AP ")`

The component renders a sticky filter bar (grade toggles, AP-only toggle, department select, search) and a grouped card list. Filtering is done with two `useMemo` passes: `filtered` (flat array) → `grouped` (entries by department). Cards expand on click to show full description and metadata.

**`vite.config.js`** sets `base: "./"` for GitHub Pages compatibility. If deploying to a specific subpath (e.g. `/whs-course-catalog/`), update `base` to match.

### Deployment to GitHub Pages

```bash
npm install -D gh-pages
# add to package.json scripts: "deploy": "gh-pages -d dist"
npm run build && npm run deploy
```
