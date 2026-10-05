// The personal invitation. Everything on this page hangs off one slug in the
// URL; without it there is no guest, so the page says so plainly rather than
// pretending to work.

import { getClient, publicImageUrl } from './supabase-client.js?v=14';

const $ = id => document.getElementById(id);
const slug = new URLSearchParams(location.search).get('g');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let guest = null;
let attending = null;
let opened = false;

/* ---------- opening the envelope ---------------------------------- */

const SPARK = 'M12 0C13.1 8.2 15.8 10.9 24 12C15.8 13.1 13.1 15.8 12 24C10.9 15.8 8.2 13.1 0 12C8.2 10.9 10.9 8.2 12 0Z';
const TINTS = ['#AEB489', '#7D8456', '#8E3347', '#E4D9C4'];

// A burst thrown from the mouth of the envelope: random angle, random reach,
// random life, so no two sparks travel together.
function burst(originX, originY, count = 28) {
  const layer = $('dust');
  if (!layer || reduce) return;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const reach = 80 + Math.random() * 190;
    const size = 5 + Math.random() * 12;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.width = `${size.toFixed(1)}px`;
    svg.style.left = `${originX - size / 2}px`;
    svg.style.top = `${originY - size / 2}px`;
    svg.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(0)}px`);
    svg.style.setProperty('--dy', `${(Math.sin(angle) * reach - 36).toFixed(0)}px`);
    svg.style.setProperty('--life', `${(1.1 + Math.random() * 1.1).toFixed(2)}s`);
    svg.style.animationDelay = `${(Math.random() * 0.32).toFixed(2)}s`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', SPARK);
    path.setAttribute('fill', TINTS[i % TINTS.length]);
    svg.appendChild(path);
    layer.appendChild(svg);

    svg.addEventListener('animationend', () => svg.remove());
  }
}

function reveal() {
  const pieces = document.querySelectorAll('#stage .rise, .foot');
  if (reduce || !('IntersectionObserver' in window)) {
    pieces.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  pieces.forEach(el => io.observe(el));
}

function openCard() {
  if (opened) return;
  opened = true;

  const cover = $('cover');
  const r = cover.getBoundingClientRect();
  cover.classList.add('opening');

  // Two waves: one as the seal breaks, a fuller one as the card clears.
  burst(r.left + r.width / 2, r.top + r.height * 0.52, 24);
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.34, 30), 560);

  setTimeout(() => {
    $('scene').hidden = true;
    $('stage').hidden = false;
    $('foot').hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
    reveal();
  }, reduce ? 0 : 860);
}

/* ---------- copy and pictures from the database ------------------- */

// Everything visible here is editable from the admin panel. Rather than list
// the fields twice, the markup carries data-key and this walks it.
async function loadCopy(sb) {
  const [{ data: content }, { data: config }, { data: art }] = await Promise.all([
    sb.from('site_content').select('key,value_th'),
    sb.from('site_settings').select('key,value'),
    sb.from('gallery').select('storage_path,caption,kind,slot').eq('kind', 'art')
  ]);

  const map = Object.fromEntries((content || []).map(r => [r.key, r.value_th]));
  document.querySelectorAll('[data-key]').forEach(el => {
    const v = map[el.dataset.key];
    if (v) { if (el.tagName === 'A') el.href = v; else el.textContent = v; }
  });

  const cfg = Object.fromEntries((config || []).map(r => [r.key, r.value]));
  document.documentElement.dataset.hints = cfg.show_slot_hints === 'false' ? 'off' : 'on';

  // The envelope, the seal and the bouquets. A slot keeps its dashed box
  // until a picture arrives; art the page drew for itself gets replaced.
  const bySlot = new Map((art || []).filter(p => p.slot).map(p => [p.slot, p]));
  for (const el of document.querySelectorAll('[data-slot],[data-art]')) {
    const row = bySlot.get(el.dataset.slot || el.dataset.art);
    if (!row) continue;
    const url = await publicImageUrl(row.storage_path);
    if (!url) continue;
    let img = el.querySelector(':scope > img');
    if (!img) {
      img = document.createElement('img');
      img.decoding = 'async';
      el.appendChild(img);
    }
    img.src = url;
    img.alt = row.caption || '';
    el.classList.add('is-filled');
  }

  return cfg;
}

/* ---------- nothing to show --------------------------------------- */

function showBlank(message) {
  for (const id of ['dust', 'foot', 'keepsake']) {
    const el = $(id);
    if (el) el.remove();
  }

  document.querySelector('.page').innerHTML = `
    <div class="blank">
      <svg viewBox="0 0 60 42" width="58" fill="none" stroke="#6E1F2E" stroke-width="1" stroke-linecap="round" aria-hidden="true">
        <path d="M28 20C20 8 6 6 4 15C2 23 16 26 28 20Z"/><path d="M32 20C40 8 54 6 56 15C58 23 44 26 32 20Z"/>
        <ellipse cx="30" cy="20" rx="5" ry="4"/><path d="M27 25C24 31 23 36 24 40"/><path d="M33 25C36 31 37 36 36 40"/>
      </svg>
      <h2>Worawan &amp; Chat</h2>
      <p></p>
      <a class="btn" href="../">Event details</a>
    </div>`;
  document.querySelector('.blank p').textContent = message;
}

/* ---------- the reply --------------------------------------------- */

function bindRsvp(sb) {
  const buttons = [...document.querySelectorAll('.choice button')];
  const select = (btn) => {
    attending = btn.dataset.attending === 'yes';
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  };
  buttons.forEach(btn => btn.addEventListener('click', () => select(btn)));

  // Someone who already answered should see their own choice waiting for
  // them, not a blank form that makes them wonder whether it saved.
  if (guest?.has_replied) {
    const prev = buttons.find(b => (b.dataset.attending === 'yes') === !!guest.attending);
    if (prev) select(prev);
    $('rsvp-status').textContent = 'You have already replied. Sending again updates your answer.';
  }

  $('rsvp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('rsvp-status');
    if (attending === null) { status.textContent = 'Please choose one of the two.'; return; }

    const btn = $('rsvp-submit');
    btn.disabled = true;
    status.textContent = 'Sending…';

    const { error } = await sb.rpc('submit_rsvp', {
      p_slug: slug,
      p_attending: attending,
      p_party_size: 1,
      p_note: $('rsvp-note').value || ''
    });

    btn.disabled = false;
    if (error) {
      status.textContent = error.message.includes('guest_not_found')
        ? 'We could not find this invitation link.'
        : 'That did not save. Please try once more.';
      return;
    }
    status.textContent = attending
      ? 'Thank you — we will see you on the day.'
      : 'Thank you for letting us know.';
  });
}

/* ---------- saving the card as a picture -------------------------- */

$('save-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const label = btn.querySelector('span');
  const original = label.textContent;
  btn.disabled = true;
  label.textContent = 'Creating…';

  try {
    if (!window.html2canvas) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    // Without this the capture can run while the webfonts are still
    // swapping, and the saved card comes out in Times New Roman.
    if (document.fonts) await document.fonts.ready;

    const canvas = await window.html2canvas($('keepsake'), {
      backgroundColor: '#7A8151',
      scale: 2,
      useCORS: true,
      logging: false
    });

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `invitation-${slug || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    label.textContent = 'Saved';
  } catch (err) {
    console.warn(err);
    label.textContent = 'Could not save';
  } finally {
    btn.disabled = false;
    setTimeout(() => { label.textContent = original; }, 2600);
  }
});

/* ---------- boot --------------------------------------------------- */

(async function boot() {
  if (!slug) {
    showBlank('This page opens from the personal link on your invitation. If you have not received one yet, please ask the couple.');
    return;
  }

  const sb = await getClient();
  if (!sb) {
    showBlank('We cannot reach the invitation right now. Please try again in a little while.');
    return;
  }

  await loadCopy(sb);

  const { data, error } = await sb.rpc('get_guest_by_slug', { p_slug: slug });
  guest = Array.isArray(data) ? data[0] : data;

  if (error || !guest) {
    showBlank('We could not find a name for this link. Please check it again, or ask the couple.');
    return;
  }

  const name = guest.name_th || '';

  const cover = $('cover-name');
  if (cover) { cover.textContent = name; cover.classList.add('in'); }
  const keep = $('keepsake-name');
  if (keep) keep.textContent = name;

  if (guest.message) {
    $('guest-msg').textContent = guest.message;
    $('guest-note').hidden = false;
  }

  if (document.fonts) await document.fonts.ready;

  $('cover').addEventListener('click', openCard);
  bindRsvp(sb);
  sb.rpc('log_card_view', { p_slug: slug }).catch(() => {});
})();
