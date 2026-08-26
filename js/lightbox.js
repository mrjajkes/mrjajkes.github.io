/* ==========================================================================
   lightbox -- shared by the works grid and the bluesky feed
   --------------------------------------------------------------------------
   Ported from the previous build's script.js, which got the fundamentals
   right and is kept close to verbatim: <dialog> + showModal(), prev/next,
   arrow keys, 45px touch-swipe threshold, and focus restored to the element
   that opened it.

   Added here: named groups (so the feed can share the component without its
   items being interleaved with the artwork), and a View Transitions morph
   from thumbnail to full-size image.
   ========================================================================== */

const dialog = document.querySelector('#lightbox');
const image = dialog.querySelector('img');
const caption = dialog.querySelector('#lightbox-caption');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const canMorph =
  typeof document.startViewTransition === 'function' && !reduceMotion.matches;

/** @type {Map<string, Array<{thumb: string, full: string, alt: string, title: string}>>} */
const groups = new Map();

let active = null; // { group, index }
let opener = null;
let token = 0;     // guards async full-size upgrades against fast navigation

/**
 * Register a set of images under a group name. Navigation stays inside the
 * group, so arrowing through the feed never wanders into the portfolio.
 */
export function register(name, items) {
  groups.set(name, items);
}

function paint(index) {
  const items = groups.get(active.group);
  active.index = (index + items.length) % items.length;

  const item = items[active.index];
  const stamp = ++token;

  // Show the thumbnail immediately -- it is already decoded, so the morph has
  // something real to animate. Upgrade to full-size in the background.
  image.src = item.thumb;
  image.alt = item.alt;
  caption.textContent =
    `${String(active.index + 1).padStart(2, '0')} / ` +
    `${String(items.length).padStart(2, '0')} · ${item.title}`;

  if (item.full && item.full !== item.thumb) {
    const hires = new Image();
    hires.decoding = 'async';
    hires.onload = () => {
      // Ignore if the user has since navigated elsewhere.
      if (stamp === token) image.src = item.full;
    };
    hires.src = item.full;
  }
}

export function open(groupName, index, trigger) {
  const items = groups.get(groupName);
  if (!items || !items.length) return;

  active = { group: groupName, index };
  opener = trigger ?? null;

  if (!canMorph || !trigger) {
    paint(index);
    if (!dialog.open) dialog.showModal();
    return;
  }

  // Old snapshot: the thumbnail carries the morph name.
  trigger.style.viewTransitionName = 'art-morph';

  const transition = document.startViewTransition(() => {
    // Release it before the new snapshot is taken -- two elements cannot hold
    // the same view-transition-name at once.
    trigger.style.viewTransitionName = '';
    image.style.viewTransitionName = 'art-morph';
    paint(index);
    if (!dialog.open) dialog.showModal();
  });

  transition.finished.finally(() => {
    image.style.viewTransitionName = '';
    trigger.style.viewTransitionName = '';
  });
}

function step(delta) {
  paint(active.index + delta);
}

function close() {
  if (!canMorph || !opener) {
    dialog.close();
    return;
  }

  const trigger = opener;
  image.style.viewTransitionName = 'art-morph';

  const transition = document.startViewTransition(() => {
    image.style.viewTransitionName = '';
    trigger.style.viewTransitionName = 'art-morph';
    dialog.close();
  });

  transition.finished.finally(() => {
    trigger.style.viewTransitionName = '';
  });
}

/* --- wiring ------------------------------------------------------------- */

dialog.querySelector('.previous').addEventListener('click', () => step(-1));
dialog.querySelector('.next').addEventListener('click', () => step(1));
dialog.querySelector('.lightbox-close').addEventListener('click', close);

// Click the backdrop area (the dialog element itself) to dismiss.
dialog.addEventListener('click', event => {
  if (event.target === dialog) close();
});

dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') step(-1);
  if (event.key === 'ArrowRight') step(1);
});

// Escape closes natively, so restore focus on the close event rather than
// only in our own handler.
dialog.addEventListener('close', () => {
  token++; // cancel any in-flight full-size upgrade
  opener?.focus();
});

let touchStart = null;

dialog.addEventListener(
  'touchstart',
  event => {
    touchStart = event.touches[0]?.clientX ?? null;
  },
  { passive: true }
);

dialog.addEventListener(
  'touchend',
  event => {
    if (touchStart === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
    if (Math.abs(distance) > 45) step(distance < 0 ? 1 : -1);
    touchStart = null;
  },
  { passive: true }
);
