// Every string and every picture on the page already has a sensible default
// in the HTML. This module swaps in whatever the couple has edited. If
// Supabase is slow, unconfigured, or down, the page still reads correctly.

import { getClient, publicImageUrl } from './supabase-client.js?v=15';

const CACHE_KEY = 'bf-content-v3';

export const settings = {
  show_gallery: false,
  show_wishes: true,
  show_slot_hints: true,
  event_datetime: '2026-11-21T14:00:00+07:00'
};

// A switch in the admin panel has to move something on the page. A toggle
// that controls nothing is worse than no toggle: it teaches the couple that
// the panel lies. Gallery is handled separately because it also needs photos.
const SECTION_TOGGLES = { wishes: 'show_wishes' };

function toggle(id, on) {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
}

/* ---------- text -------------------------------------------------- */

function applyText(rows) {
  for (const row of rows) {
    const value = row.value_th || row.value_en;
    if (!value) continue;
    document.querySelectorAll(`[data-key="${row.key}"]`).forEach(el => {
      if (el.tagName === 'A') el.href = value;
      else el.textContent = value;
    });
  }
}

/* ---------- pictures ---------------------------------------------- */

// Two kinds of hole in the design. A slot is a space reserved for a
// photograph the couple has not taken yet, so while it is empty it shows a
// dashed box naming what goes there. Art is a piece the page draws for
// itself — the envelope, the wax seal — so it never shows a box; the upload
// simply takes the drawing's place.
async function fillPictures(art) {
  const bySlot = new Map(art.filter(p => p.slot).map(p => [p.slot, p]));

  for (const el of document.querySelectorAll('[data-slot],[data-art]')) {
    const name = el.dataset.slot || el.dataset.art;
    const row = bySlot.get(name);
    if (!row) continue;

    const url = await publicImageUrl(row.storage_path);
    if (!url) continue;

    let img = el.querySelector(':scope > img');
    if (!img) {
      img = document.createElement('img');
      img.decoding = 'async';
      img.loading = 'lazy';
      el.appendChild(img);
    }
    img.src = url;
    img.alt = row.caption || '';
    el.classList.add('is-filled');
  }
}

async function fillGallery(photos) {
  const grid = document.querySelector('.gallery__grid');
  const rest = photos.filter(p => p.kind === 'gallery');
  const show = settings.show_gallery && rest.length > 0;
  toggle('gallery', show);
  if (!show || !grid) return;

  grid.innerHTML = '';
  for (const p of rest) {
    const url = await publicImageUrl(p.storage_path);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.full = url;
    const img = document.createElement('img');
    img.src = url;
    img.alt = p.caption || 'Worawan and Chat';
    img.loading = 'lazy';
    img.decoding = 'async';
    btn.appendChild(img);
    grid.appendChild(btn);
  }
}

/* ---------- wishes ------------------------------------------------ */

function fillWishes(wishes) {
  const list = document.getElementById('wishes-list');
  if (!list) return;
  if (!wishes.length) return;

  list.innerHTML = '';
  for (const w of wishes) {
    const card = document.createElement('article');
    card.className = 'wish card-paper';
    const p = document.createElement('p');
    p.textContent = w.message;
    const b = document.createElement('b');
    b.textContent = w.display_name;
    card.append(p, b);
    list.appendChild(card);
  }
}

/* ---------- the pass ---------------------------------------------- */

async function apply({ content, config, photos, wishes }) {
  if (content) applyText(content);

  if (config) {
    for (const row of config) {
      if (row.value === 'true' || row.value === 'false') settings[row.key] = row.value === 'true';
      else settings[row.key] = row.value;
    }
    for (const [id, key] of Object.entries(SECTION_TOGGLES)) toggle(id, settings[key] !== false);
    // One switch clears every empty dashed box, for the day the couple is
    // ready to send the link out.
    document.documentElement.dataset.hints = settings.show_slot_hints === false ? 'off' : 'on';
  }

  if (photos) {
    await fillPictures(photos.filter(p => p.kind === 'art'));
    await fillGallery(photos);
  }

  if (wishes) fillWishes(wishes);
}

export async function loadContent() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try { await apply(JSON.parse(cached)); } catch { sessionStorage.removeItem(CACHE_KEY); }
  }

  const sb = await getClient();
  if (!sb) return;

  try {
    const [content, config, photos, wishes] = await Promise.all([
      sb.from('site_content').select('key,value_th,value_en'),
      sb.from('site_settings').select('key,value'),
      sb.from('gallery').select('storage_path,caption,kind,slot').order('sort_order'),
      sb.from('wishes').select('display_name,message').eq('approved', true).order('created_at', { ascending: false })
    ]);

    const payload = {
      content: content.data || [],
      config: config.data || [],
      photos: photos.data || [],
      wishes: wishes.data || []
    };
    await apply(payload);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('content load failed, keeping defaults', err);
  }
}
