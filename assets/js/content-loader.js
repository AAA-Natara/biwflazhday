// Every string on the page is already in the HTML as a sensible default.
// This module swaps in whatever the couple has edited. If Supabase is slow,
// unconfigured, or down, the page still reads correctly.

import { getClient, publicImageUrl } from './supabase-client.js?v=5';

const CACHE_KEY = 'bf-content-v1';

export const settings = {
  show_story: false,
  show_gallery: false,
  show_wishes: true,
  event_datetime: '2026-11-21T14:00:00+07:00'
};

// Every switch in the admin panel must move something on the page. A toggle
// that controls nothing is worse than no toggle: it teaches the couple that
// the panel lies. Gallery is handled separately because it also needs photos.
const SECTION_TOGGLES = {
  'story':  'show_story',
  'wishes': 'show_wishes'
};

function toggle(id, on) {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
}

// Sections start hidden in the HTML only when they are optional. If a
// settings row is missing entirely, treat it as "show" so a database hiccup
// can never blank out the invitation.

async function apply({ content, config, photos }) {
  if (content) {
    for (const row of content) {
      const value = row.value_th || row.value_en;
      if (!value) continue;
      document.querySelectorAll(`[data-key="${row.key}"]`).forEach(el => {
        if (el.tagName === 'A') el.href = value;
        else el.textContent = value;
      });
    }
  }

  if (config) {
    for (const row of config) {
      if (row.value === 'true' || row.value === 'false') settings[row.key] = row.value === 'true';
      else settings[row.key] = row.value;
    }
    for (const [id, key] of Object.entries(SECTION_TOGGLES)) toggle(id, settings[key] !== false);
  }

  if (photos) {
    const hero = photos.filter(p => p.kind === 'hero');
    const rest = photos.filter(p => p.kind !== 'hero');

    await buildPortrait(hero);

    const grid = document.querySelector('#gallery .grid');
    const show = settings.show_gallery && rest.length > 0;
    toggle('gallery', show);
    if (show && grid) {
      grid.innerHTML = '';
      for (const p of rest) {
        const url = await publicImageUrl(p.storage_path);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.full = url;
        const img = document.createElement('img');
        img.src = url;
        img.alt = p.caption || 'ภาพคู่บ่าวสาว';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);
        grid.appendChild(btn);
      }
    }
  }
}

// The hero photo frame stays hidden until there is something to show, so the
// page never reserves space for an empty box.
async function buildPortrait(hero) {
  const fig = document.getElementById('portrait');
  const stack = document.getElementById('portrait-stack');
  const dots = document.getElementById('portrait-dots');
  if (!fig || !stack || !dots) return;

  if (!hero.length) { fig.hidden = true; return; }

  stack.innerHTML = '';
  dots.innerHTML = '';

  for (const [i, p] of hero.entries()) {
    const img = document.createElement('img');
    img.src = await publicImageUrl(p.storage_path);
    img.alt = p.caption || 'ภาพคู่บ่าวสาว';
    img.decoding = 'async';
    if (i > 0) img.loading = 'lazy';
    stack.appendChild(img);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `ภาพที่ ${i + 1}`);
    dot.setAttribute('aria-selected', String(i === 0));
    dots.appendChild(dot);
  }
  dots.hidden = hero.length < 2;
  fig.hidden = false;
  document.dispatchEvent(new CustomEvent('portrait:ready'));
}

export async function loadContent() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try { await apply(JSON.parse(cached)); } catch { sessionStorage.removeItem(CACHE_KEY); }
  }

  const sb = await getClient();
  if (!sb) return;

  try {
    const [content, config, photos] = await Promise.all([
      sb.from('site_content').select('key,value_th,value_en'),
      sb.from('site_settings').select('key,value'),
      sb.from('gallery').select('storage_path,caption,kind').order('sort_order')
    ]);

    const payload = {
      content: content.data || [],
      config: config.data || [],
      photos: photos.data || []
    };
    await apply(payload);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('content load failed, keeping defaults', err);
  }
}
