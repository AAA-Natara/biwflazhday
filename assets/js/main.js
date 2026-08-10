// Boot order matters: the ribbon, countdown and reveal must all work with no
// network at all. Supabase is touched only after the page already looks right.

import { drawRibbon, animateRibbon, bindScrollDraw } from './ribbon.js';
import { loadContent, settings } from './content-loader.js';
import { getClient } from './supabase-client.js';

document.documentElement.classList.add('js');

/* ---------- ribbon ------------------------------------------------ */

let redrawTimer;
function redraw() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => { drawRibbon(); bindScrollDraw(); }, 120);
}

drawRibbon();
animateRibbon();
window.addEventListener('resize', redraw);
new ResizeObserver(redraw).observe(document.body);
if (document.fonts) document.fonts.ready.then(redraw);
document.addEventListener('toggle', redraw, true); // FAQ accordions change height

/* ---------- countdown --------------------------------------------- */

function tickCountdown() {
  const box = document.getElementById('countdown');
  if (!box) return;
  const target = new Date(settings.event_datetime).getTime();
  if (!Number.isFinite(target)) return;
  const diff = target - Date.now();
  if (diff <= 0) { box.hidden = true; return; }

  const pad = n => String(n).padStart(2, '0');
  set('days', Math.floor(diff / 86400000));
  set('hours', pad(Math.floor(diff / 3600000) % 24));
  set('mins', pad(Math.floor(diff / 60000) % 60));
  set('secs', pad(Math.floor(diff / 1000) % 60));

  function set(unit, value) {
    const n = box.querySelector(`[data-unit=${unit}] .n`);
    if (n && n.textContent !== String(value)) n.textContent = value;
  }
}

/* ---------- playful layer ------------------------------------------ */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Names rise a letter at a time. Screen readers keep the whole word because
// the original text stays in the aria-label.
function splitNames() {
  document.querySelectorAll('#hero .name').forEach((el, block) => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    if (reduce) return;
    el.textContent = '';
    const base = block === 0 ? 0.25 : 0.95;
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = ch;
      span.style.animationDelay = `${(base + i * 0.055).toFixed(2)}s`;
      el.appendChild(span);
    });
  });
  const surs = document.querySelectorAll('#hero .surname');
  if (surs[0]) surs[0].style.animationDelay = '0.9s';
  if (surs[1]) surs[1].style.animationDelay = '1.2s';
}

// Marquee: the strip is duplicated so translateX(-50%) loops seamlessly.
function fillMarquee() {
  const track = document.getElementById('track');
  if (!track) return;
  const items = ['WORAWAN & CHAT', '21 . 11 . 2026', 'MUANGTHONG CHURCH', '14:00', 'SAVE THE DATE'];
  const run = items.map(t => {
    const em = document.createElement('em');
    em.textContent = t;
    const i = document.createElement('i');
    i.textContent = '\u25C6';
    return [em, i];
  }).flat();
  for (let copy = 0; copy < 4; copy++) {
    run.forEach(node => track.appendChild(node.cloneNode(true)));
  }
}

// Hero motifs drift with the pointer. Touch devices simply never fire this.
function bindParallax() {
  const hero = document.getElementById('hero');
  if (!hero || reduce) return;
  const floats = hero.querySelectorAll('.fl');
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    floats.forEach(f => {
      const d = parseFloat(f.dataset.depth || 20);
      f.style.transform = `translate(${(x * d).toFixed(1)}px, ${(y * d * 0.6).toFixed(1)}px)`;
    });
  });
  hero.addEventListener('pointerleave', () => {
    floats.forEach(f => { f.style.transform = ''; });
  });
}

// Buttons lean toward the cursor, then snap back.
function bindMagnetic() {
  if (reduce) return;
  document.querySelectorAll('.link').forEach(el => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      el.style.transform = `translateX(${(x * 8).toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// The bar appears once the hero is behind you, and hides again at the top.
function bindMiniBar() {
  const bar = document.getElementById('minibar');
  const hero = document.getElementById('hero');
  if (!bar || !hero) return;
  new IntersectionObserver(([e]) => {
    bar.classList.toggle('show', !e.isIntersecting);
    bar.setAttribute('aria-hidden', e.isIntersecting ? 'true' : 'false');
  }, { threshold: 0 }).observe(hero);
}

/* ---------- add to calendar --------------------------------------- */

function icsStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

document.getElementById('ics-btn')?.addEventListener('click', () => {
  const start = new Date(settings.event_datetime);
  const end = new Date(start.getTime() + 2 * 3600000);
  const venue = document.querySelector('[data-key="event.venue"]')?.textContent.trim() || '';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//biwflazhday//TH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:wedding-biwflazh-2026@biwflazhday.online',
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    'SUMMARY:Worawan & Chat Wedding',
    `LOCATION:${venue}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Wedding tomorrow',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'biwflazh-wedding.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ---------- scroll reveal ------------------------------------------ */

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }
}, { rootMargin: '0px 0px -12% 0px' });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));
// Safety net: nothing is allowed to stay invisible if something above throws.
setTimeout(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')), 2500);

/* ---------- wishes --------------------------------------------------- */

async function loadWishes() {
  const list = document.getElementById('wish-list');
  const sb = await getClient();
  if (!list || !sb) return;

  const { data } = await sb.from('wishes')
    .select('display_name,message')
    .order('created_at', { ascending: false })
    .limit(30);
  if (!data || !data.length) return;

  list.innerHTML = '';
  for (const w of data) {
    const li = document.createElement('li');
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = w.display_name;
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = w.message;
    li.append(who, msg);
    list.appendChild(li);
  }
  redraw();
}

document.getElementById('wish-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const status = document.getElementById('wish-status');
  const sb = await getClient();
  if (!sb) { status.textContent = 'ยังเชื่อมต่อฐานข้อมูลไม่ได้'; return; }

  status.textContent = 'กำลังส่ง…';
  const { error } = await sb.rpc('submit_wish', {
    p_display_name: document.getElementById('wish-name').value,
    p_message: document.getElementById('wish-message').value,
    p_slug: new URLSearchParams(location.search).get('g')
  });
  if (error) { status.textContent = 'ส่งไม่สำเร็จ กรุณาลองอีกครั้ง'; return; }
  form.reset();
  status.textContent = 'ส่งแล้ว คำอวยพรจะขึ้นหลังเจ้าภาพตรวจ';
});

/* ---------- boot ------------------------------------------------------ */

splitNames();
fillMarquee();
bindParallax();
bindMagnetic();
bindMiniBar();

tickCountdown();
setInterval(tickCountdown, 1000);

(async function boot() {
  await loadContent();
  tickCountdown();
  if (settings.show_wishes) loadWishes();
  redraw();
})();
