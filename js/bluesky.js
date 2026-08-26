/* ==========================================================================
   bluesky -- the feed section
   --------------------------------------------------------------------------
   Deliberately self-contained: this module owns one <section> and touches
   nothing else. Moving #feed and this script to a separate page is all it
   would take to split the feed off entirely.

   The public AppView needs no key and sends `access-control-allow-origin: *`,
   so this is a plain browser fetch -- no proxy, no token, no build step.
   ========================================================================== */

import { register, open } from './lightbox.js';
import { observeReveals } from './main.js';

const HANDLE = 'mrjajkes.bsky.social';
const ENDPOINT =
  'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed' +
  `?actor=${HANDLE}&limit=18&filter=posts_with_media`;

const CACHE_KEY = 'bsky:feed:v1';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const WANTED = 12;

const grid = document.querySelector('#feed-grid');


/* ==========================================================================
   text cleanup
   Raw post text is unusable as a caption: often empty, often nothing but
   hashtags ("#ss14 #spacestation14 #ss13 #spacestation13"). Image alt text is
   almost always empty too, so it is only a weak second choice.
   ========================================================================== */

/**
 * Peel a trailing run of hashtags off the end, one tag at a time.
 *
 * Done iteratively rather than with a single lookahead because punctuation
 * clings to tags in real posts -- "Captain. #Cielvern #Sketch #Anthro
 * #Traditional." ends with a period *after* the last tag, which defeats any
 * pattern anchored straight to $. Each pass strictly shortens the string, so
 * the loop always terminates.
 */
function stripHashtagTail(input) {
  let out = input;
  for (;;) {
    const next = out.replace(/\s*#[\p{L}\p{N}_]+[\s.,!?]*$/u, '');
    if (next === out) return out;
    out = next;
  }
}

function replaceEmDashes(input) {
  return (input || '').replace(/\u2014/g, '--');
}

function describe(text, alt) {
  const cleaned = stripHashtagTail(replaceEmDashes(text))
    // Collapse newlines into a middot so multi-line posts stay on two lines.
    .replace(/\s*\n+\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // Stripping a hashtag tail can leave dangling punctuation behind,
    // e.g. "Nill Colemann, #SpaceStation14" → "Nill Colemann,"
    .replace(/[,;:·\-\s]+$/u, '');

  return cleaned || replaceEmDashes(alt).trim();
}

function relativeTime(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const seconds = Math.max(0, (Date.now() - then.getTime()) / 1000);
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['w', 604800],
    ['d', 86400],
    ['h', 3600],
    ['m', 60]
  ];

  for (const [label, span] of units) {
    if (seconds >= span) return `${Math.floor(seconds / span)}${label} ago`;
  }
  return 'just now';
}


/* ==========================================================================
   embed normalisation
   `filter=posts_with_media` still returns video posts, and quote-posts nest
   their images one level deeper under `media`. Both are handled rather than
   silently dropped, which would leave holes in the grid.
   ========================================================================== */

function readMedia(embed) {
  if (!embed) return null;

  const type = embed['$type'];

  if (type === 'app.bsky.embed.images#view') {
    return { kind: 'images', images: embed.images ?? [] };
  }

  if (type === 'app.bsky.embed.video#view') {
    return {
      kind: 'video',
      thumb: embed.thumbnail,
      aspectRatio: embed.aspectRatio
    };
  }

  if (type === 'app.bsky.embed.recordWithMedia#view') {
    return readMedia(embed.media);
  }

  return null;
}

function toItem(entry) {
  // Reposts are somebody else's work; skip them.
  if (entry.reason) return null;

  const post = entry.post;
  const media = readMedia(post.embed);
  if (!media) return null;

  const rkey = post.uri.split('/').pop();
  const url = `https://bsky.app/profile/${HANDLE}/post/${rkey}`;
  const createdAt = post.record?.createdAt ?? post.indexedAt;

  if (media.kind === 'video') {
    if (!media.thumb) return null;
    return {
      kind: 'video',
      thumb: media.thumb,
      full: media.thumb,
      alt: describe(post.record?.text, '') || 'Video post',
      ratio: media.aspectRatio,
      extra: 0,
      text: describe(post.record?.text, ''),
      url,
      createdAt
    };
  }

  const [first, ...rest] = media.images;
  if (!first) return null;

  return {
    kind: 'image',
    thumb: first.thumb,
    full: first.fullsize,
    alt: replaceEmDashes(first.alt) || describe(post.record?.text, '') || 'Artwork posted on Bluesky',
    ratio: first.aspectRatio,
    extra: rest.length,
    text: describe(post.record?.text, first.alt),
    url,
    createdAt
  };
}


/* ==========================================================================
   rendering
   ========================================================================== */

function aspect(ratio) {
  if (ratio?.width && ratio?.height) return `${ratio.width}/${ratio.height}`;
  return '1';
}

function skeletons() {
  // Plausible mixed ratios so the grid does not jump when real posts land.
  const shapes = ['3/4', '1', '4/5', '16/9', '3/4', '1'];
  grid.replaceChildren(
    ...shapes.map(ratio => {
      const cell = document.createElement('div');
      cell.className = 'tile skeleton';
      cell.style.setProperty('--ar', ratio);
      return cell;
    })
  );
}

function fallback() {
  const line = document.createElement('p');
  line.className = 'feed-fallback';
  line.innerHTML =
    `<a href="https://bsky.app/profile/${HANDLE}" target="_blank" rel="noopener noreferrer">` +
    '↗ see the latest on bluesky</a>';

  grid.replaceChildren(line);
  grid.style.display = 'block';
  grid.setAttribute('aria-busy', 'false');
}

function render(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const cell = document.createElement('article');
    cell.className = 'feed-item reveal';
    cell.style.setProperty('--i', String(index % 8));

    /* --- the image tile --- */
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.style.setProperty('--ar', aspect(item.ratio));
    tile.setAttribute('aria-label', `Open image: ${item.text || 'untitled post'}`);

    const img = document.createElement('img');
    img.src = item.thumb;
    img.alt = item.alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    tile.append(img);

    if (item.kind === 'video') {
      const play = document.createElement('span');
      play.className = 'badge play';
      play.textContent = '▶';
      tile.append(play);
    } else if (item.extra > 0) {
      const more = document.createElement('span');
      more.className = 'badge';
      more.textContent = `+${item.extra}`;
      tile.append(more);
    }

    tile.addEventListener('click', () => open('feed', index, tile));
    cell.append(tile);

    /* --- caption --- */
    if (item.text) {
      const text = document.createElement('p');
      text.className = 'feed-text';
      text.textContent = item.text;
      cell.append(text);
    }

    /* --- meta line --- */
    const meta = document.createElement('p');
    meta.className = 'feed-meta';

    const time = document.createElement('time');
    time.dateTime = item.createdAt;
    time.textContent = relativeTime(item.createdAt);
    meta.append(time);

    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '↗ bsky';
    meta.append(link);

    cell.append(meta);
    fragment.append(cell);
  });

  grid.replaceChildren(fragment);
  grid.setAttribute('aria-busy', 'false');

  register('feed', items.map(item => ({
    thumb: item.thumb,
    full: item.full,
    alt: item.alt,
    title: item.text || relativeTime(item.createdAt)
  })));

  observeReveals(grid);
}


/* ==========================================================================
   fetch, with a short session cache so in-page navigation does not refetch
   ========================================================================== */

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, items } = JSON.parse(raw);
    if (!Array.isArray(items) || Date.now() - at > CACHE_TTL) return null;
    return items;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* private mode or quota -- the feed just refetches next time */
  }
}

async function load() {
  if (!grid) return;

  const cached = readCache();
  if (cached?.length) {
    render(cached);
    return;
  }

  skeletons();

  try {
    const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`bluesky responded ${response.status}`);

    const payload = await response.json();
    const items = (payload.feed ?? [])
      .map(toItem)
      .filter(Boolean)
      .slice(0, WANTED);

    if (!items.length) throw new Error('no media posts returned');

    writeCache(items);
    render(items);
  } catch {
    // Never show an error or a broken grid -- just the one quiet line.
    fallback();
  }
}

load();
