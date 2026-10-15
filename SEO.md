# UP NaukriGuru Search Engine Optimization

Canonical website: https://naukripreps.com/ (set by `CNAME`).

## Current site architecture
- Indexable public URLs: home, /up-police-constable/, /free-diagnostic/, /download/, /blog/launch/, /privacy/, /delete-account/.
- `sitemap.xml` lists only these real public URLs; no fragments, login/admin screens, tests lab, report cards, APK files or unvalidated papers.
- `robots.txt` advertises the sitemap, keeps script and stylesheet resources accessible for rendering, and excludes downloadable binaries/source directories.
- SPA landing contains a descriptive static HTML fallback, allowing basic content and internal links to exist before JavaScript loads.
- `assets/app.js` applies `noindex,nofollow` when a logged-out visitor enters a hash-based non-landing route or a signed-in visitor enters any app route.
- JSON-LD metadata identifies the website and visible informational pages. Never add FAQ answers not visible to students.
- Social image: `/social-preview.png` (1200 × 630 pixels).

## After publishing
1. Verify `https://naukripreps.com/sitemap.xml`, `https://naukripreps.com/robots.txt`, `https://naukripreps.com/social-preview.png` and each sitemap URL return HTTP 200 over HTTPS. Check canonical redirect behaviour for www and alternative domains.
2. Add the `https://naukripreps.com/` property in Google Search Console and submit `https://naukripreps.com/sitemap.xml` in **Indexing → Sitemaps**. Request indexing for the homepage and the two guides.
3. In Search Console, check crawl/indexability, mobile usability, canonical selection and Core Web Vitals; no indexing or ranking position can be guaranteed.
4. If the brand/domain changes, change CNAME, all canonical/OG/JSON-LD URLs, sitemap, and robots **together**. Do not create dual competing canonicals.
5. Update the sitemap after adding an indexable page, using its real last modification date; do not include drafts, login/admin routes, private results or unreviewed exam content.

## Technical note
GitHub Pages serves the static shell at `/`, while student routes use URL fragments (`/#/...`). Such fragment routes cannot be separately indexed as distinct canonical pages. Publish substantial public informational content as real static paths and link to it from the homepage and footer. Never expose answer keys or private data in SEO pages.
