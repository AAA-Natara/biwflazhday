// Boot order matters: the ribbon, countdown and reveal must all work with no
// network at all. Supabase is touched only after the page already looks right.

import { drawRibbon, animateRibbon } from './ribbon.js';
import { loadContent, settings } from './content-loader.js';
import { getClient } from './supabase-client.js';

document.documentElement.classList.add('js');

/* ---------- ribbon ------------------------------------------------ */

let redrawTimer;
function redraw() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(drawRibbon, 120);
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

  box.querySelector('[data-unit=days] .n').textContent = Math.floor(diff / 86400000);
  box.querySelector('[data-unit=hours] .n').textContent = Math.floor(diff / 3600000) % 24;
  box.querySelector('[data-unit=mins] .n').textContent = Math.floor(diff / 60000) % 60;
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

tickCountdown();
setInterval(tickCountdown, 30000);

(async function boot() {
  await loadContent();
  tickCountdown();
  if (settings.show_wishes) loadWishes();
  redraw();
})();
