# personal-site

Personal website for Enrique Alabort — [enriquealabort.uk](https://enriquealabort.uk)

A single-page static site. No build step, no dependencies: open `index.html` in a
browser, or serve the directory.

```bash
python3 -m http.server 8000
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole page: hero, profile, experience timeline, innovation, contact |
| `style.css` | All styling; design tokens live in `:root` at the top |
| `script.js` | The lattice engine (generation, cursor field, scroll-driven print), rotating words, top bar, scroll reveals |
| `404.html` | Not-found page, styled to match |
| `og-image.png` | 1200×630 link-preview card (LinkedIn, Slack, X) |
| `favicon.svg` | "EA" monogram |
| `CNAME` | Custom domain for GitHub Pages |
| `robots.txt`, `sitemap.xml` | Search engine basics |

## The lattice

One fixed canvas sits behind the whole page.

- **Generation** — Poisson-disc nodes, Delaunay struts, struts flatter than 30° to the
  horizontal dropped (self-supporting, as a powder-bed part would be). The slider
  targets a strut count between 600 and 3,000, independent of screen size, and
  corrects itself to within ±3%. Constants live at the top of the lattice section
  in `script.js` (`STRUTS_MIN`, `STRUTS_MAX`, `FIELD_R`, `BAND_FRAC`).
- **Cursor field** — struts within `FIELD_R` of the pointer thicken and brighten,
  using a spatial hash so cost doesn't grow with density. Fades out on scroll.
- **Print** — a melt line sits in the gap between the Profile and Experience
  sections and scrolls with the page. Below it struts fatten across a band, then
  a pre-rendered matte-metal layer (diffuse shading, powder-bed grain, joint
  shadows) takes over. The metal layer is drawn once in idle slices after each
  generation, so scrolling only blits it.
- Everything respects `prefers-reduced-motion`.

## Editing

- **Experience** — each role is an `<article class="timeline-item">` in `#experience`,
  newest first. The topmost one carries `class="timeline-item current"` for the
  pulsing marker.
- **Hero words** — the two rotating words are `data-words` JSON arrays on the
  `.dynamic-word` spans.
- **Cache-busting** — `style.css?v=N` / `script.js?v=N` in `index.html`; bump when
  changing either.
- **Colours, spacing, fonts** — the custom properties at the top of `style.css`.

## Deployment

GitHub Pages serves `main` from the repository root. Pushing to `main` publishes.
The `CNAME` file binds the custom domain; DNS is managed at GoDaddy.

## Accessibility & motion

With `prefers-reduced-motion` set, the grow-in, cursor field, rotating words and
scroll reveals are off; the print still tracks scroll but without easing. The
canvas only animates while something is actually changing.
