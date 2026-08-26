import { register, open } from './lightbox.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


const tiles = [...document.querySelectorAll('#works-grid .tile')];

register(
  'works',
  tiles.map(tile => ({
    thumb: tile.dataset.image,
    full: tile.dataset.image,
    alt: tile.querySelector('img').alt,
    title: tile.dataset.title
  }))
);

tiles.forEach((tile, index) => {
  tile.addEventListener('click', () => open('works', index, tile));
});


const revealed = new WeakSet();

const revealObserver = new IntersectionObserver(
  entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || revealed.has(entry.target)) continue;
      revealed.add(entry.target);
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
);

export function observeReveals(root = document) {
  const targets = [...root.querySelectorAll('.reveal')];
  targets.forEach((el, i) => {
    if (!el.style.getPropertyValue('--i')) {
      el.style.setProperty('--i', String(i % 8));
    }
    revealObserver.observe(el);
  });
}

observeReveals();


const navLinks = [...document.querySelectorAll('#rail-nav a')];
const sections = navLinks
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);
let activeSectionId = null;

function markActive(id) {
  if (id === activeSectionId) return;
  activeSectionId = id;

  for (const link of navLinks) {
    const isActive = link.getAttribute('href') === `#${id}`;
    if (isActive) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

const rail = document.querySelector('.rail');
const narrowLayout = window.matchMedia('(max-width: 900px)');
let spyQueued = false;

function updateActiveSection() {
  spyQueued = false;
  if (!sections.length) return;

  const marker = narrowLayout.matches
    ? (rail?.getBoundingClientRect().height ?? 0) + 56
    : Math.min(220, window.innerHeight * 0.25);
  let active = sections[0];

  for (const section of sections) {
    if (section.getBoundingClientRect().top > marker) break;
    active = section;
  }

  const atPageEnd = window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 2;
  if (atPageEnd) active = sections.at(-1);

  markActive(active.id);
}

function queueActiveUpdate() {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(updateActiveSection);
}

window.addEventListener('scroll', queueActiveUpdate, { passive: true });
window.addEventListener('resize', queueActiveUpdate);
window.addEventListener('hashchange', queueActiveUpdate);
new ResizeObserver(queueActiveUpdate).observe(document.body);
updateActiveSection();


document.querySelector('#lone-star')?.addEventListener('click', () => {
  document.querySelector('#sound')?.scrollIntoView({
    behavior: reduceMotion.matches ? 'auto' : 'smooth',
    block: 'start'
  });
});


document.querySelector('#copy-discord')?.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText('mrjajkes');
    status.textContent = '> copied to clipboard';
  } catch {
    status.textContent = '> discord: mrjajkes';
  }
});
