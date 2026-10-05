# Static French guides and agent documentation

This is a fresh reconstruction made on 5 October 2026 after the earlier local
candidate was lost in an execution-environment reset. It is not the old commit
4cd5098993c5945833bde27fa19a103394b87070. The reviewed article content and approved
architecture were reconstructed from the task conversation and checked again.
The source baseline is public main 26cf326f0858effd954057e239dd77668e6eb2f9.
Every existing workflow and public/.htaccess is preserved byte-for-byte.

## Pages and architecture

- `/guides/`
- `/guides/retrouver-adresse-annonce/`
- `/guides/rechercher-avec-dpe/`
- `/guides/dpe-recent-vente/`
- `/documentation/agents/`
- `/documentation/agents/capabilities.json`

The source articles are in `content/guides/`. `scripts/guides/generate.mjs`
emits complete HTML documents, individual metadata/canonical links and WebPage
JSON-LD, a shared hashed stylesheet, and a descriptive JSON document. There is
no search API, MCP server, llms.txt or executable agent endpoint. Article dates
are declared editorial dates, not dates changed automatically on every build.

The homepage gains one ordinary footer link. The header and search form remain
unchanged; the information page gains contextual reading links. Guides use
normal anchors, with a visible return-to-search link. They require no runtime
JavaScript, map, external font, cookie or tracking request. System fonts and
responsive CSS keep the pages light. The app's saved theme is not read by the
static documents; their colour scheme follows the system preference.

These assets are explicitly excluded from the PWA precache. The existing
navigation fallback remains limited to app routes. Existing older catch-all
workers may briefly intercept guide navigation until they update. Added PWA
tests verify navigation after a completed upgrade and absence from offline
caches; they do not remove that historical transient condition.

The five HTML documents enter the sitemap. The descriptive JSON is linked from
HTML, not listed as a sitemap page. The existing Apache configuration does not
rewrite real directories, so ordinary DirectoryIndex serving is intended.
Production status, content type, slash handling and unknown-path 404 behaviour
still require a release-stage check. This source increment does not deploy the site.

## Crawler rules

Retrieval agents OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User,
PerplexityBot and Perplexity-User receive exact public guide/docs allowances,
including the descriptive JSON and stylesheet. Query variants and other paths
remain disallowed in their group. The generic JSON exclusion receives one exact
exception. Previous training/legacy exclusions remain, and current ClaudeBot
is explicitly blocked. Robots rules express preferences, not access controls;
user-directed fetchers may disregard them. No firewall or security settings
have changed. No indexing, ranking, recommendation or citation is promised.

Primary crawler/SEO references checked on 5 October 2026:

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.openai.com/api/docs/bots
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://docs.perplexity.ai/docs/resources/perplexity-crawlers

## Editorial and factual review

The earlier draft received an implementation/factual check, an independent
French review with two readings, and a final reread. This reconstructed text
received a new independent French review and a new technical review. Examples
are fictitious. The language stays practical and avoids the removed marketing
claims. The historical fact-check confirmed the validity condition for DPE
attestations, inclusive comparison boundaries in the implementation, and the
possibility of expanded results having different DPE/GES classes.

Sources retained beside article claims:

- https://data.ademe.fr/datasets/dpe03existant
- https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052134589
- https://rt-re-batiment.developpement-durable.gouv.fr/faq-dpe-modification-du-facteur-de-conversion-en-a1021.html
- https://www.legifrance.gouv.fr/eli/arrete/2026/8/19/VLOL2617030A/jo/texte
- https://www.ecologie.gouv.fr/politiques-publiques/diagnostic-performance-energetique-dpe

The 2026 electricity coefficient of 1.9 and the enacted January 2027 coefficient
of 1.7 are kept distinct. No human authorship or firsthand experience is claimed.

## Verification and CI

`npm run test:html` covers generated documents, links, structured data, escaping,
capability truth, controls/labels and robots specificity. The existing built-site
check verifies emitted content and exclusions from homepage/PWA loading.
`npm run test:guides:http` checks the six actual HTTP endpoints without a browser.

`e2e/product-pages.spec.js` registers six guide cases from `guides-checks.js` so
the existing unchanged CI's product suite includes them. All old assertions and
hooks remain; its H2 expectation now includes the added information section.
The guide cases cover raw responses, a JS-disabled narrow viewport, JSON,
375px/1280px Back/Forward navigation, real numeric/class controls and contextual
links. `npm run test:guides` is an optional isolated two-project run using port
4187 and separate evidence paths. Existing PWA lifecycle tests also check guides
after worker upgrade and reject guide fallback/offline caching.

Full browser execution remains pending. The earlier browser launch/socket and
cloud-localhost restrictions have not been bypassed. In this reconstruction,
request-only Playwright cases inherited the existing product context hook and
stopped because its browser executable was unavailable; the separate plain HTTP
checker subsequently validated those endpoints. Raw HTTP is not visual/mobile
browser validation. The fresh check results are recorded in the recovery bundle.

The separate marketing-copy cleanup is not included in this increment. It is
based on current public main and does not modify workflow metadata or deploy
settings. This increment does not authorize a main-branch merge or production deployment.
