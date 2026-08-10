// Boot order matters: the ribbon, countdown and reveal must all work with no
// network at all. Supabase is touched only after the page already looks right.

import { drawRibbon, animateRibbon } from './ribbon.js';
import { loadContent, settings } from './content-loader.js';
import { getClient } from './supabase-client.js';

document.documentElement.classList.add('js');

const guestSlug = new URLSearchParams(location.search).get('g');

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

/* ---------- countdown --------------------------------------------- */

function tickCountdown() {
  const box = document.getElementById('countdown');
  if (!box) return;
  const target = new Date(settings.event_datetime).getTime();
  const diff = target - Date.now();
  if (!Number.isFinite(target)) return;
  if (diff <= 0) { box.hidden = true; return; }

  box.querySelector('[data-unit=days] .n').textContent = Math.floor(diff / 86400000);
  box.querySelector('[data-unit=hours] .n').textContent = Math.floor(diff / 3600000) % 24;
  box.querySelector('[data-unit=mins] .n').textContent = Math.floor(diff / 60000) % 60;
}

/* ---------- scroll reveal ------------------------------------------ */

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }
}, { rootMargin: '0px 0px -12% 0px' });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));
// Safety net: if anything above throws, nothing stays invisible.
setTimeout(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')), 2500);

/* ---------- rsvp ---------------------------------------------------- */

const rsvpForm = document.getElementById('rsvp-form');
let attending = null;

document.querySelectorAll('.choice button').forEach(btn => {
  btn.addEventListener('click', () => {
    attending = btn.dataset.attending === 'yes';
    document.querySelectorAll('.choice button').forEach(b => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    const seats = document.getElementById('party-field');
    if (seats) seats.hidden = !attending;
  });
});

if (rsvpForm) {
  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('rsvp-status');

    if (attending === null) { status.textContent = 'กรุณาเลือกว่าจะมาร่วมงานหรือไม่'; return; }
    if (!guestSlug) { status.textContent = 'ลิงก์นี้ไม่มีรหัสผู้รับเชิญ กรุณาเปิดจากลิงก์ที่ได้รับ'; return; }

    const sb = await getClient();
    if (!sb) { status.textContent = 'ยังเชื่อมต่อฐานข้อมูลไม่ได้'; return; }

    status.textContent = 'กำลังบันทึก…';
    const { error } = await sb.rpc('submit_rsvp', {
      p_slug: guestSlug,
      p_attending: attending,
      p_party_size: Number(document.getElementById('party-size')?.value || 1),
      p_note: document.getElementById('rsvp-note')?.value || ''
    });

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
    status.textContent = attending ? 'บันทึกแล้ว แล้วพบกันวันงาน' : 'บันทึกแล้ว ขอบคุณที่แจ้งให้ทราบ';
    rsvpForm.querySelector('button[type=submit]').disabled = true;
  });
}

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
}

const wishForm = document.getElementById('wish-form');
if (wishForm) {
  wishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('wish-status');
    const sb = await getClient();
    if (!sb) { status.textContent = 'ยังเชื่อมต่อฐานข้อมูลไม่ได้'; return; }

    status.textContent = 'กำลังส่ง…';
    const { error } = await sb.rpc('submit_wish', {
      p_display_name: document.getElementById('wish-name').value,
      p_message: document.getElementById('wish-message').value,
      p_slug: guestSlug
    });
    if (error) { status.textContent = 'ส่งไม่สำเร็จ กรุณาลองอีกครั้ง'; return; }
    wishForm.reset();
    status.textContent = 'ส่งแล้ว คำอวยพรจะขึ้นหลังเจ้าภาพตรวจ';
  });
}

/* ---------- boot ------------------------------------------------------ */

tickCountdown();
setInterval(tickCountdown, 30000);

(async function boot() {
  await loadContent();
  tickCountdown();
  if (settings.show_wishes) loadWishes();
  if (!settings.rsvp_open) {
    const btn = rsvpForm?.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; document.getElementById('rsvp-status').textContent = 'ปิดรับคำตอบแล้ว'; }
  }
  redraw();
})();
