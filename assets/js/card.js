// Personal invitation card. Everything on this page hangs off one slug in the
// URL; without it there is no guest, so the page says so plainly rather than
// pretending to work.

import { getClient } from './supabase-client.js';

const $ = id => document.getElementById(id);
const slug = new URLSearchParams(location.search).get('g');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let guest = null;
let attending = null;
let opened = false;

/* ---------- the opening ------------------------------------------- */

const SPARK = 'M12 0C13.1 8.2 15.8 10.9 24 12C15.8 13.1 13.1 15.8 12 24C10.9 15.8 8.2 13.1 0 12C8.2 10.9 10.9 8.2 12 0Z';
const TINTS = ['#AEC6DA', '#D6A2AC', '#D9C3AE'];

// A burst thrown from the mouth of the envelope: random angle, random reach,
// random life, so no two sparks travel together.
function burst(originX, originY, count = 34) {
  const layer = $('dust');
  if (!layer || reduce) return;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const reach = 90 + Math.random() * 210;
    const size = 6 + Math.random() * 15;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.width = `${size.toFixed(1)}px`;
    svg.style.left = `${originX - size / 2}px`;
    svg.style.top = `${originY - size / 2}px`;
    svg.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(0)}px`);
    svg.style.setProperty('--dy', `${(Math.sin(angle) * reach - 40).toFixed(0)}px`);
    svg.style.setProperty('--life', `${(1.1 + Math.random() * 1.1).toFixed(2)}s`);
    svg.style.animationDelay = `${(Math.random() * 0.35).toFixed(2)}s`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', SPARK);
    path.setAttribute('fill', TINTS[i % TINTS.length]);
    svg.appendChild(path);
    layer.appendChild(svg);

    svg.addEventListener('animationend', () => svg.remove());
  }
}

const BALLOON_TINTS = [
  ['#AEC6DA', '#93B0C9'],   // sky
  ['#D6A2AC', '#C08D97'],   // rose
  ['#E5D3C2', '#D0B79E'],   // nude
];

// Balloons drawn rather than imaged: a body, a pinched knot, and a slack
// string. Each gets its own speed and sway so the group never moves as one.
function releaseBalloons(count = 13) {
  if (reduce) return;
  const layer = document.createElement('div');
  layer.className = 'balloons';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const [body, shade] = BALLOON_TINTS[i % BALLOON_TINTS.length];
    const w = 34 + Math.random() * 34;

    const b = document.createElement('div');
    b.className = 'balloon';
    b.style.width = `${w.toFixed(0)}px`;
    b.style.left = `${(4 + Math.random() * 88).toFixed(1)}%`;
    b.style.setProperty('--dur', `${(7.5 + Math.random() * 5).toFixed(1)}s`);
    b.style.setProperty('--wait', `${(Math.random() * 1.6).toFixed(2)}s`);
    b.style.setProperty('--swayDur', `${(2.6 + Math.random() * 2).toFixed(1)}s`);

    b.innerHTML = `
      <svg viewBox="0 0 60 116" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="36" rx="27" ry="34" fill="${body}"/>
        <path d="M14 20C18 12 25 8 32 8" stroke="#FDFBF7" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55"/>
        <path d="M30 70l-6 8h12l-6-8Z" fill="${shade}"/>
        <path d="M30 78C36 88 24 96 30 106C34 112 30 114 28 116" stroke="${shade}" stroke-width="1" fill="none" stroke-linecap="round"/>
      </svg>`;
    layer.appendChild(b);
  }

  // The whole layer removes itself once the slowest balloon has left.
  setTimeout(() => layer.remove(), 16000);
}

function openEnvelope() {
  if (opened) return;
  opened = true;

  const env = $('envelope');
  const scene = $('scene');
  const hint = $('scene-hint');
  const stage = $('stage');

  env.classList.add('opening');
  if (hint) hint.textContent = '';

  const r = env.getBoundingClientRect();
  // Two waves: one as the flap lifts, a fuller one as the card clears the top.
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.34, 20), 340);
  setTimeout(releaseBalloons, 620);
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.18, 34), 900);

  setTimeout(() => {
    scene.hidden = true;
    stage.hidden = false;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, reduce ? 0 : 1750);
}

/* ---------- copy from the database -------------------------------- */

// Everything visible on this page is editable from the admin panel. Rather
// than list the fields twice, the markup carries data-key and this walks it.
async function loadCopy(sb) {
  if (!sb) return {};

  const shared = ['event.date', 'event.venue', 'event.time', 'footer.apology',
                  'hero.bride_first', 'hero.groom_first'];
  const keys = [...document.querySelectorAll('[data-key]')].map(el => el.dataset.key).concat(shared);
  const [{ data: content }, { data: config }] = await Promise.all([
    sb.from('site_content').select('key,value_th').in('key', [...new Set(keys)]),
    sb.from('site_settings').select('key,value')
  ]);

  const map = Object.fromEntries((content || []).map(r => [r.key, r.value_th]));
  document.querySelectorAll('[data-key]').forEach(el => {
    const v = map[el.dataset.key];
    if (v) el.textContent = v;
  });

  const set = (sel, key) => {
    const el = document.querySelector(sel);
    if (el && map[key]) el.textContent = map[key];
  };
  set('.card__date', 'event.date');
  set('.card__venue', 'event.venue');
  set('.card__time', 'event.time');
  set('.card__foot', 'footer.apology');

  // The couple's names live under the landing-page keys; the card borrows them.
  const names = document.querySelectorAll('.c-name');
  if (names[0] && map['hero.bride_first']) names[0].textContent = map['hero.bride_first'];
  if (names[1] && map['hero.groom_first']) names[1].textContent = map['hero.groom_first'];
  const mini = document.querySelector('.mini__names');
  if (mini && map['hero.bride_first'] && map['hero.groom_first']) {
    mini.textContent = `${map['hero.bride_first']} & ${map['hero.groom_first']}`;
  }

  return Object.fromEntries((config || []).map(r => [r.key, r.value]));
}

/* ---------- guest ------------------------------------------------- */

function showBlank(message) {
  const dust = $('dust');
  if (dust) dust.remove();
  document.querySelector('.page').innerHTML = `
    <div class="blank">
      <svg viewBox="0 0 60 42" width="58" fill="none" stroke="#AEC6DA" stroke-width="1" stroke-linecap="round" aria-hidden="true">
        <path d="M28 20C20 8 6 6 4 15C2 23 16 26 28 20Z"/><path d="M32 20C40 8 54 6 56 15C58 23 44 26 32 20Z"/>
        <ellipse cx="30" cy="20" rx="5" ry="4"/><path d="M27 25C24 31 23 36 24 40"/><path d="M33 25C36 31 37 36 36 40"/>
      </svg>
      <h2>Worawan &amp; Chat</h2>
      <p></p>
      <a class="btn" href="../">ดูรายละเอียดงาน</a>
    </div>`;
  document.querySelector('.blank p').textContent = message;
}

/* ---------- rsvp -------------------------------------------------- */

function bindRsvp(sb, config) {
  const buttons = [...document.querySelectorAll('.choice button')];
  const select = (btn) => {
    attending = btn.dataset.attending === 'yes';
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  };
  buttons.forEach(btn => btn.addEventListener('click', () => select(btn)));

  // Someone who already answered should see their own choice waiting for
  // them, not a blank form that makes them wonder if it saved.
  if (guest?.has_replied) {
    const prev = buttons.find(b => (b.dataset.attending === 'yes') === !!guest.attending);
    if (prev) select(prev);
    $('rsvp-status').textContent = 'คุณตอบไว้แล้ว เปลี่ยนคำตอบได้โดยส่งใหม่อีกครั้ง';
  }

  $('rsvp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('rsvp-status');
    if (attending === null) { status.textContent = 'กรุณาเลือกว่าจะมาร่วมงานหรือไม่'; return; }

    const btn = $('rsvp-submit');
    btn.disabled = true;
    status.textContent = 'กำลังบันทึก…';

    const { error } = await sb.rpc('submit_rsvp', {
      p_slug: slug,
      p_attending: attending,
      p_party_size: 1,
      p_note: $('rsvp-note').value || ''
    });

    btn.disabled = false;
    if (error) {
      status.textContent = error.message.includes('guest_not_found')
        ? 'ไม่พบรายชื่อสำหรับลิงก์นี้'
        : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
      return;
    }
    status.textContent = attending
      ? 'บันทึกแล้ว แล้วพบกันวันงาน'
      : 'บันทึกแล้ว ขอบคุณที่แจ้งให้ทราบ';
  });
}

/* ---------- save as image ----------------------------------------- */

$('save-btn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const label = btn.querySelector('span');
  const original = label.textContent;
  btn.disabled = true;
  label.textContent = 'กำลังสร้างรูป…';

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
    // Without this the capture can run while the webfonts are still swapping,
    // and the saved card comes out in Times New Roman.
    if (document.fonts) await document.fonts.ready;

    const canvas = await window.html2canvas($('card'), {
      backgroundColor: '#FDFBF7',
      scale: Math.max(2, window.devicePixelRatio || 1),
      useCORS: true,
      logging: false
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitation-${slug || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    label.textContent = 'บันทึกแล้ว';
  } catch (err) {
    console.warn(err);
    label.textContent = 'บันทึกไม่สำเร็จ';
  } finally {
    btn.disabled = false;
    setTimeout(() => { label.textContent = original; }, 2600);
  }
});

/* ---------- boot --------------------------------------------------- */

(async function boot() {
  if (!slug) {
    showBlank('หน้านี้เปิดได้จากลิงก์การ์ดเชิญส่วนตัวเท่านั้น หากยังไม่ได้รับลิงก์ กรุณาติดต่อเจ้าภาพ');
    return;
  }

  const sb = await getClient();
  if (!sb) {
    showBlank('ขณะนี้ยังเชื่อมต่อข้อมูลไม่ได้ กรุณาลองอีกครั้งในภายหลัง');
    return;
  }

  const config = await loadCopy(sb);

  const { data, error } = await sb.rpc('get_guest_by_slug', { p_slug: slug });
  guest = Array.isArray(data) ? data[0] : data;

  if (error || !guest) {
    showBlank('ไม่พบรายชื่อสำหรับลิงก์นี้ กรุณาตรวจสอบลิงก์อีกครั้ง หรือติดต่อเจ้าภาพ');
    return;
  }

  const full = guest.name_th;

  const envName = $('env-name');
  if (envName) envName.textContent = full;

  const msgEl = $('guest-msg');
  if (msgEl && guest.message) {
    msgEl.textContent = guest.message;
    msgEl.hidden = false;
  }

  const nameEl = $('guest-name');
  nameEl.textContent = full;
  if (document.fonts) await document.fonts.ready;

  $('envelope').addEventListener('click', openEnvelope);

  import('./sparkles.js')
    .then(mod => mod.startSparkles())
    .catch(err => console.warn('sparkles unavailable', err));
  bindRsvp(sb, config);
  sb.rpc('log_card_view', { p_slug: slug }).catch(() => {});
})();
