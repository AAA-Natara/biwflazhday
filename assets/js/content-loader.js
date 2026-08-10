// Every string on the page is already in the HTML as a sensible default.
// This module swaps in whatever the couple has edited. If Supabase is slow,
// unconfigured, or down, the page still reads correctly.

import { getClient, publicImageUrl } from './supabase-client.js';

const CACHE_KEY = 'bf-content-v1';

export const settings = {
  show_story: false,
  show_gallery: false,
  show_wishes: true,
  rsvp_open: true,
  event_datetime: '2026-11-21T14:00:00+07:00'
};

function toggle(id, on) {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
}

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
    toggle('story', settings.show_story);
    toggle('wishes', settings.show_wishes);
  }

  if (photos) {
    const grid = document.querySelector('#gallery .grid');
    const show = settings.show_gallery && photos.length > 0;
    toggle('gallery', show);
    if (show && grid) {
      grid.innerHTML = '';
      for (const p of photos) {
        const img = document.createElement('img');
        img.src = await publicImageUrl(p.storage_path);
        img.alt = p.caption || 'ภาพคู่บ่าวสาว';
        img.loading = 'lazy';
        img.decoding = 'async';
        grid.appendChild(img);
      }
    }
  }
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
      sb.from('gallery').select('storage_path,caption').order('sort_order')
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
