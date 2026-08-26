const dialog = document.querySelector('#lightbox');
const image = dialog.querySelector('img');
const caption = dialog.querySelector('#lightbox-caption');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const canMorph =
  typeof document.startViewTransition === 'function' && !reduceMotion.matches;

const groups = new Map();

let active = null; // { group, index }
let opener = null;
let token = 0;     // guards async full-size upgrades against fast navigation

export function register(name, items) {
  groups.set(name, items);
}

function paint(index) {
  const items = groups.get(active.group);
  active.index = (index + items.length) % items.length;

  const item = items[active.index];
  const stamp = ++token;
  image.src = item.thumb;
  image.alt = item.alt;
  caption.textContent =
    `${String(active.index + 1).padStart(2, '0')} / ` +
    `${String(items.length).padStart(2, '0')} · ${item.title}`;

  if (item.full && item.full !== item.thumb) {
    const hires = new Image();
    hires.decoding = 'async';
    hires.onload = () => {
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
  trigger.style.viewTransitionName = 'art-morph';

  const transition = document.startViewTransition(() => {
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

dialog.querySelector('.previous').addEventListener('click', () => step(-1));
dialog.querySelector('.next').addEventListener('click', () => step(1));
dialog.querySelector('.lightbox-close').addEventListener('click', close);
dialog.addEventListener('click', event => {
  if (event.target === dialog) close();
});

dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') step(-1);
  if (event.key === 'ArrowRight') step(1);
});
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
