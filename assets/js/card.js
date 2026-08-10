// Personal invitation card. Everything on this page hangs off one slug in the
// URL; without it there is no guest, so the page says so plainly rather than
// pretending to work.

import { getClient } from './supabase-client.js';

const $ = id => document.getElementById(id);
const slug = new URLSearchParams(location.search).get('g');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let guest = null;
let attending = null;
let party = 1;
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
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.18, 34), 900);

  setTimeout(() => {
    scene.hidden = true;
    stage.hidden = false;
    fitName($('guest-name'));
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, reduce ? 0 : 1750);
}

/* ---------- copy from the database -------------------------------- */

const COPY_KEYS = ['event.date', 'event.venue', 'event.time', 'footer.apology',
                   'hero.bride_first', 'hero.groom_first'];

async function loadCopy(sb) {
  if (!sb) return {};
  const [{ data: content }, { data: config }] = await Promise.all([
    sb.from('site_content').select('key,value_th').in('key', COPY_KEYS),
    sb.from('site_settings').select('key,value')
  ]);

  const map = Object.fromEntries((content || []).map(r => [r.key, r.value_th]));
  const set = (sel, key) => {
    const el = document.querySelector(sel);
    if (el && map[key]) el.textContent = map[key];
  };
  set('.card__date', 'event.date');
  set('.card__venue', 'event.venue');
  set('.card__time', 'event.time');
  set('.card__foot', 'footer.apology');

  const names = document.querySelectorAll('.card__name');
  if (names[0] && map['hero.bride_first']) names[0].textContent = map['hero.bride_first'];
  if (names[1] && map['hero.groom_first']) names[1].textContent = map['hero.groom_first'];

  return Object.fromEntries((config || []).map(r => [r.key, r.value]));
}

/* ---------- guest ------------------------------------------------- */

// Thai names vary wildly in length: "คุณเอ" against "ครอบครัวสงทองธรรม" is a
// four-fold difference. Rather than wrap or truncate, shrink until it fits.
function fitName(el) {
  const box = el.parentElement;
  // While scene 2 is still hidden the box has no width, so there is nothing
  // to measure against; the caller re-runs this once the card is on screen.
  if (!box.clientWidth) return;
  let size = 22;
  el.style.fontSize = size + 'px';
  while (el.scrollWidth > box.clientWidth - 8 && size > 12) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
}

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
  const open = config.rsvp_open !== 'false';
  const sub = $('rsvp-sub');
  if (config.rsvp_deadline && sub) {
    sub.textContent = `กรุณาตอบรับภายในวันที่ ${config.rsvp_deadline}`;
  }

  if (!open) {
    $('rsvp-form').hidden = true;
    if (sub) sub.textContent = 'ปิดรับคำตอบแล้ว หากมีข้อสงสัยกรุณาติดต่อเจ้าภาพโดยตรง';
    return;
  }

  const seats = Math.max(1, guest?.seats || 1);
  $('seat-hint').textContent = seats > 1
    ? `เชิญไว้ ${seats} ที่นั่ง` : 'เชิญไว้ 1 ที่นั่ง';

  const paint = () => {
    $('party-size').textContent = party;
    $('minus').disabled = party <= 1;
    $('plus').disabled = party >= seats;
  };
  $('minus').addEventListener('click', () => { party = Math.max(1, party - 1); paint(); });
  $('plus').addEventListener('click', () => { party = Math.min(seats, party + 1); paint(); });
  paint();

  document.querySelectorAll('.choice button').forEach(btn => {
    btn.addEventListener('click', () => {
      attending = btn.dataset.attending === 'yes';
      document.querySelectorAll('.choice button')
        .forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      $('party-field').hidden = !attending;
    });
  });

  if (guest?.has_replied) {
    $('rsvp-status').textContent = 'คุณตอบรับไว้แล้ว ส่งใหม่อีกครั้งเพื่อแก้ไขคำตอบเดิมได้';
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
      p_party_size: party,
      p_note: $('rsvp-note').value || ''
    });

    btn.disabled = false;
    if (error) {
      const map = {
        rsvp_closed: 'ปิดรับคำตอบแล้ว',
        guest_not_found: 'ไม่พบรายชื่อสำหรับลิงก์นี้',
        party_size_out_of_range: 'จำนวนผู้ร่วมงานเกินที่นั่งที่เชิญไว้'
      };
      const key = Object.keys(map).find(k => error.message.includes(k));
      status.textContent = map[key] || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
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

  const full = [guest.title, guest.name_th].filter(Boolean).join(' ');

  const envName = $('env-name');
  if (envName) envName.textContent = full;

  const nameEl = $('guest-name');
  nameEl.textContent = full;
  if (document.fonts) await document.fonts.ready;
  fitName(nameEl);

  $('envelope').addEventListener('click', openEnvelope);
  bindRsvp(sb, config);
  sb.rpc('log_card_view', { p_slug: slug }).catch(() => {});
})();
