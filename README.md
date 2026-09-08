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
| `script.js` | Hero particle canvas, rotating words, sticky nav, scroll reveals |
| `404.html` | Not-found page, styled to match |
| `og-image.png` | 1200×630 link-preview card (LinkedIn, Slack, X) |
| `favicon.svg` | "EA" monogram |
| `CNAME` | Custom domain for GitHub Pages |
| `robots.txt`, `sitemap.xml` | Search engine basics |

## Editing

- **Experience** — each role is an `<article class="timeline-item">` in `#experience`,
  newest first. The topmost one carries `class="timeline-item current"` for the
  pulsing marker.
- **Hero words** — the two rotating words are `data-words` JSON arrays on the
  `.dynamic-word` spans.
- **Colours, spacing, fonts** — the custom properties at the top of `style.css`.

## Deployment

GitHub Pages serves `main` from the repository root. Pushing to `main` publishes.
The `CNAME` file binds the custom domain; DNS is managed at GoDaddy.

## Accessibility & motion

The site honours `prefers-reduced-motion`: the particle canvas, rotating words and
scroll reveals are all disabled when a visitor has asked for reduced motion.
The canvas also stops animating when the hero scrolls out of view or the tab is
hidden, to avoid draining battery.
