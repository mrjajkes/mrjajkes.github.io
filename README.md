# mrjajkes.site

A dependency-free static portfolio for mrjajkes (Andry) -- artist, musician,
multimedia creator. No build step, no `node_modules`, no framework.

## Preview locally

The site uses ES modules, so it needs to be served over HTTP -- opening
`index.html` straight off disk (`file://`) will not work.

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Structure

```
index.html         all markup -- the works grid is static HTML, so it works without JS
css/tokens.css     palette, type scale, reset
css/site.css       rail, sections, tiles, feed, lightbox, responsive
js/lightbox.js     shared lightbox: grouped items + View Transitions morph
js/main.js         scroll-spy, reveals, clipboard
js/audio.js        compact shared player for the local music catalogue
js/bluesky.js      the feed section -- self-contained
assets/            artwork and profile imagery
```

Sections are a single scroll: `#index`, `#works`, `#feed`, `#contact`, `#sound`.
A sticky rail on the left carries the wordmark, nav, socials and a scroll
decorative hairline; under 900px it collapses to a top bar.

## Design rules

The previous build desaturated and cropped every piece of artwork, which is
what made it look flat. Three rules keep that from coming back:

1. **No `filter` on artwork or feed images.** Full saturation is the design --
   the work is the only real colour on the page.
2. **No `object-fit: cover` on artwork.** Every tile declares its own
   `--ar` from the image's intrinsic size, so nothing is ever cropped and
   ragged bottom edges are intentional.
3. **The canvas stays near-black.** Olive is chrome -- numerals, mono labels,
   active nav, hairlines, focus rings, the wordmark, one radial bloom. It is
   never a large background field and never tints an image.

Palette and contrast ratios are documented at the top of `css/tokens.css`.
`--olive-dim` is decoration-only at 2.6:1 and must never carry text.

## Bluesky feed

`js/bluesky.js` reads the public AppView directly from the browser:

```
https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed
  ?actor=mrjajkes.bsky.social&limit=18&filter=posts_with_media
```

No API key and no proxy -- the endpoint sends `access-control-allow-origin: *`.
Notes on the real data, since none of it is obvious:

- `filter=posts_with_media` **still returns video posts**. Those render their
  `embed.thumbnail` with a `▶` marker rather than being dropped.
- Post text is often empty or nothing but hashtags. `stripHashtagTail()` peels
  a trailing run of tags one at a time -- a single anchored regex fails on real
  posts like `Captain. #Cielvern #Sketch #Anthro #Traditional.`, where a period
  follows the last tag.
- Quote-posts nest images one level deeper under `embed.media`.
- Multi-image posts show the first image with a `+N` badge.
- Reposts are skipped.
- Results are cached in `sessionStorage` for 15 minutes.
- If the API is unreachable the section collapses to a single quiet link to the
  profile -- never a broken grid or a visible error.

To move the feed onto its own page, move the `#feed` section and the
`js/bluesky.js` script tag; it touches nothing else.

## Known TODOs

- **Artwork titles** in `index.html` are working titles. Three are corrected
  from Bluesky captions (marked `(bsky)`); the rest are descriptive
  placeholders. Captions also name characters I could not match to a specific
  file -- Matteo Howerlow, Nill Colemann, Ryland The Architect, Cielvern.
- `assets/secret.jpg` is unreferenced (it was already unused in the old build).

## Publish with GitHub Pages

1. Push this directory to a repository's `main` branch.
2. **Settings → Pages → Build and deployment → Deploy from a branch**.
3. Select `main` and `/ (root)`, then save.

`.nojekyll` is present so Jekyll does not touch the `css/` and `js/` folders.
