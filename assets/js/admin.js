import { getAdminClient, isConfigured, STORAGE_BUCKET } from './supabase-client.js';
import { shrink } from '../lib/image-resize.js';

const $ = id => document.getElementById(id);
const dirty = new Map();          // key -> new value, for site_content only
let sb = null;

const SECTION_TITLES = {
  hero:     ['หน้าแรก',      'ชื่อคู่บ่าวสาวและคำนำ'],
  verse:    ['ข้อพระคัมภีร์',  'ข้อความและที่มา'],
  headings: ['หัวข้อแต่ละส่วน', 'เลขลำดับ ชื่ออังกฤษ และชื่อไทย'],
  event:    ['วันงาน',        'วันที่ สถานที่ และแผนที่'],
  schedule: ['กำหนดการ',      'เวลาและรายละเอียดแต่ละช่วง'],
  theme:    ['สีของงาน',      'คำอธิบายใต้หัวข้อ'],
  travel:   ['การเดินทาง',    'ที่จอดรถและรถสาธารณะ'],
  story:    ['เรื่องราวของเรา', 'เปิดการแสดงผลได้ที่แท็บตั้งค่า'],
  rsvp:     ['การตอบรับ',     'ข้อความชี้แจงบนหน้าแรก'],
  footer:   ['ท้ายหน้า',      'บรรทัดปิดท้าย']
};

const FIELD_LABELS = {
  'hero.eyebrow': 'คำนำเหนือชื่อ',
  'hero.bride_first': 'ชื่อเจ้าสาว', 'hero.bride_last': 'นามสกุลเจ้าสาว',
  'hero.groom_first': 'ชื่อเจ้าบ่าว', 'hero.groom_last': 'นามสกุลเจ้าบ่าว',
  'verse.text': 'ข้อความ', 'verse.ref': 'อ้างอิง',
  'event.weekday': 'วันในสัปดาห์ (อังกฤษ)', 'event.day_num': 'เลขวันที่',
  'event.month': 'เดือนและปี (อังกฤษ)', 'event.date': 'วันที่แบบไทย',
  'event.venue': 'ชื่อสถานที่', 'event.address': 'ที่อยู่',
  'event.time': 'เวลาและพิธี', 'event.map_url': 'ลิงก์แผนที่',
  'theme.note': 'คำอธิบาย', 'story.body': 'เนื้อหา', 'rsvp.note': 'ข้อความ',
  'footer.apology': 'บรรทัดขออภัย', 'footer.signoff': 'บรรทัดปิดท้าย'
};

const SETTING_LABELS = {
  show_story:    ['แสดงเรื่องราวของเรา', 'เปิดเมื่อเขียนเนื้อหาเสร็จแล้ว'],
  show_gallery:  ['แสดงแกลเลอรี',        'ต้องมีรูปอย่างน้อยหนึ่งรูป'],
  show_wishes:   ['แสดงคำอวยพร',         'ส่วนรับคำอวยพรบนหน้าแรก'],
  show_gift:     ['แสดงส่วนของขวัญ',      'ยังไม่ได้ใช้งาน'],
  rsvp_open:     ['เปิดรับการตอบรับ',     'ปิดเมื่อเลยกำหนดแล้ว'],
  rsvp_deadline: ['กำหนดตอบรับ',          'รูปแบบ ปี-เดือน-วัน'],
  event_datetime:['วันเวลาจัดงาน',        'ใช้กับนาฬิกานับถอยหลังและปฏิทิน']
};

function labelFor(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const m = key.match(/^schedule\.(\d)_(time|text)$/);
  if (m) return `ช่วงที่ ${m[1]} · ${m[2] === 'time' ? 'เวลา' : 'รายละเอียด'}`;
  const t = key.match(/^travel\.(\d)_(head|text)$/);
  if (t) return `รายการที่ ${t[1]} · ${t[2] === 'head' ? 'หัวข้อ' : 'รายละเอียด'}`;
  const s = key.match(/^sec\.(\d)_(num|en|th)$/);
  if (s) return `ส่วนที่ ${s[1]} · ${{ num: 'เลขลำดับ', en: 'ชื่ออังกฤษ', th: 'ชื่อไทย' }[s[2]]}`;
  return key;
}

function toast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, ms);
}

function syncSaveBar() {
  const bar = $('savebar');
  bar.hidden = dirty.size === 0;
  $('dirty-count').textContent = `แก้ไข ${dirty.size} จุด`;
}

/* ================= auth ================= */

async function boot() {
  if (!isConfigured()) {
    $('login-msg').textContent = 'ยังไม่ได้ใส่ค่า Supabase ในไฟล์ assets/js/supabase-client.js';
    return;
  }
  sb = await getAdminClient();
  if (!sb) { $('login-msg').textContent = 'เชื่อมต่อ Supabase ไม่ได้'; return; }

  const { data } = await sb.auth.getSession();
  if (data.session) enterApp();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('login-msg');
  if (!sb) { msg.textContent = 'ยังเชื่อมต่อฐานข้อมูลไม่ได้'; return; }

  msg.textContent = 'กำลังเข้าสู่ระบบ…';
  const { error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value
  });
  if (error) { msg.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'; return; }

  // Being signed in is not the same as being allowed in.
  const { data: allowed } = await sb.rpc('is_admin');
  if (!allowed) {
    await sb.auth.signOut();
    msg.textContent = 'บัญชีนี้ยังไม่ได้รับสิทธิ์ กรุณาเพิ่ม user_id ในตาราง admin_users';
    return;
  }
  msg.textContent = '';
  enterApp();
});

$('logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

function enterApp() {
  $('login').hidden = true;
  $('app').hidden = false;
  window.scrollTo(0, 0);
  loadContent();
  loadSettings();
  loadGallery('hero');
  loadGallery('gallery');
  loadWishes();
}

/* ================= tabs ================= */

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === btn));
  document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== `tab-${btn.dataset.tab}`; });
});

/* ================= content ================= */

async function loadContent() {
  const box = $('content-groups');
  const { data, error } = await sb.from('site_content')
    .select('key,value_th,field_type,section,sort_order')
    .order('section').order('sort_order');

  if (error || !data) { box.innerHTML = '<p class="dim">โหลดข้อความไม่สำเร็จ</p>'; return; }

  const order = Object.keys(SECTION_TITLES);
  const groups = {};
  for (const row of data) (groups[row.section] ||= []).push(row);

  box.innerHTML = '';
  const sections = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b));

  for (const name of sections) {
    const [title, hint] = SECTION_TITLES[name] || [name, ''];
    const wrap = document.createElement('div');
    wrap.className = 'group';

    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.className = 'group__hint';
    p.textContent = hint;
    wrap.append(h, p);

    for (const row of groups[name]) {
      const field = document.createElement('div');
      field.className = 'field';

      const label = document.createElement('label');
      label.setAttribute('for', `f-${row.key}`);
      label.textContent = labelFor(row.key) + ' ';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = row.key;
      label.appendChild(key);

      const input = row.field_type === 'textarea'
        ? document.createElement('textarea')
        : Object.assign(document.createElement('input'), { type: 'text' });
      input.id = `f-${row.key}`;
      input.value = row.value_th || '';
      const initial = input.value;

      input.addEventListener('input', () => {
        if (input.value === initial) dirty.delete(row.key);
        else dirty.set(row.key, input.value);
        field.classList.toggle('changed', input.value !== initial);
        syncSaveBar();
      });

      field.append(label, input);
      wrap.appendChild(field);
    }
    box.appendChild(wrap);
  }
}

$('save').addEventListener('click', async () => {
  if (!dirty.size) return;
  const btn = $('save');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก…';

  const rows = [...dirty].map(([key, value_th]) => ({ key, value_th, updated_at: new Date().toISOString() }));
  const { error } = await sb.from('site_content').upsert(rows, { onConflict: 'key' });

  btn.disabled = false;
  btn.textContent = 'บันทึก';

  if (error) { toast('บันทึกไม่สำเร็จ ' + error.message, 4000); return; }
  dirty.clear();
  document.querySelectorAll('.field.changed').forEach(f => f.classList.remove('changed'));
  syncSaveBar();
  toast('บันทึกแล้ว หน้าเว็บจะเห็นการเปลี่ยนแปลงเมื่อโหลดใหม่');
});

$('discard').addEventListener('click', () => {
  dirty.clear();
  syncSaveBar();
  loadContent();
});

/* ================= settings ================= */

async function loadSettings() {
  const box = $('settings-list');
  const { data } = await sb.from('site_settings').select('key,value').order('key');
  if (!data) { box.innerHTML = '<p class="dim">โหลดการตั้งค่าไม่สำเร็จ</p>'; return; }

  box.innerHTML = '';
  for (const row of data) {
    const [title, hint] = SETTING_LABELS[row.key] || [row.key, ''];
    const isBool = row.value === 'true' || row.value === 'false';

    const card = document.createElement('div');
    card.className = 'toggle';

    const text = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = title;
    const small = document.createElement('small');
    small.textContent = hint;
    text.append(p, small);
    card.appendChild(text);

    if (isBool) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'switch';
      sw.setAttribute('aria-pressed', row.value);
      sw.setAttribute('aria-label', title);
      sw.addEventListener('click', async () => {
        const next = sw.getAttribute('aria-pressed') !== 'true';
        sw.setAttribute('aria-pressed', String(next));
        const { error } = await sb.from('site_settings')
          .update({ value: String(next), updated_at: new Date().toISOString() })
          .eq('key', row.key);
        if (error) { sw.setAttribute('aria-pressed', String(!next)); toast('บันทึกไม่สำเร็จ'); }
        else toast('บันทึกแล้ว');
      });
      card.appendChild(sw);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = row.value || '';
      input.style.maxWidth = '240px';
      input.addEventListener('change', async () => {
        const { error } = await sb.from('site_settings')
          .update({ value: input.value.trim(), updated_at: new Date().toISOString() })
          .eq('key', row.key);
        toast(error ? 'บันทึกไม่สำเร็จ' : 'บันทึกแล้ว');
      });
      card.appendChild(input);
    }
    box.appendChild(card);
  }
}

/* ================= gallery ================= */

async function loadGallery(kind = 'gallery') {
  const box = $(kind === 'hero' ? 'hero-list' : 'gallery-list');
  const { data } = await sb.from('gallery')
    .select('id,storage_path,sort_order,kind').eq('kind', kind).order('sort_order');
  if (!data || !data.length) { box.innerHTML = '<p class="dim">ยังไม่มีรูป</p>'; return; }

  box.innerHTML = '';
  data.forEach((row, i) => {
    const url = sb.storage.from(STORAGE_BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
    const card = document.createElement('div');
    card.className = 'thumb';

    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';

    const bar = document.createElement('div');
    bar.className = 'thumb__bar';

    const up = document.createElement('button');
    up.className = 'ghost';
    up.textContent = '←';
    up.title = 'เลื่อนไปก่อนหน้า';
    up.disabled = i === 0;
    up.addEventListener('click', () => swap(data, i, i - 1, kind));

    const down = document.createElement('button');
    down.className = 'ghost';
    down.textContent = '→';
    down.title = 'เลื่อนไปถัดไป';
    down.disabled = i === data.length - 1;
    down.addEventListener('click', () => swap(data, i, i + 1, kind));

    const del = document.createElement('button');
    del.className = 'ghost ghost--danger';
    del.textContent = 'ลบ';
    del.addEventListener('click', async () => {
      if (!confirm('ลบรูปนี้ถาวรใช่ไหม')) return;
      await sb.storage.from(STORAGE_BUCKET).remove([row.storage_path]);
      await sb.from('gallery').delete().eq('id', row.id);
      toast('ลบแล้ว');
      loadGallery(kind);
    });

    bar.append(up, down, del);
    card.append(img, bar);
    box.appendChild(card);
  });
}

async function swap(rows, a, b, kind) {
  await Promise.all([
    sb.from('gallery').update({ sort_order: b * 10 }).eq('id', rows[a].id),
    sb.from('gallery').update({ sort_order: a * 10 }).eq('id', rows[b].id)
  ]);
  loadGallery(kind);
}

function bindUploader(inputId, msgId, kind) {
  const input = $(inputId);
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    const msg = $(msgId);
    let done = 0;

    for (const file of files) {
      msg.textContent = `กำลังอัปโหลด ${done + 1} จาก ${files.length}…`;
      try {
        const { blob, name, type } = await shrink(file);
        const path = `${kind}/${name}`;
        const { error: upErr } = await sb.storage.from(STORAGE_BUCKET)
          .upload(path, blob, { contentType: type, cacheControl: '31536000' });
        if (upErr) throw upErr;
        await sb.from('gallery').insert({
          storage_path: path, kind, sort_order: Date.now() % 100000
        });
        done++;
      } catch (err) {
        console.warn(err);
        msg.textContent = 'อัปโหลดไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ');
        return;
      }
    }
    msg.textContent = `อัปโหลดแล้ว ${done} รูป`;
    e.target.value = '';
    loadGallery(kind);
  });
}

bindUploader('hero-input', 'hero-msg', 'hero');
bindUploader('file-input', 'upload-msg', 'gallery');

/* ================= wishes ================= */

async function loadWishes() {
  const box = $('wishes-list');
  const { data } = await sb.from('wishes')
    .select('id,display_name,message,approved,created_at')
    .order('approved').order('created_at', { ascending: false });

  if (!data || !data.length) { box.innerHTML = '<p class="dim">ยังไม่มีคำอวยพร</p>'; return; }

  box.innerHTML = '';
  for (const w of data) {
    const card = document.createElement('div');
    card.className = 'wish' + (w.approved ? '' : ' pending');

    const head = document.createElement('div');
    const who = document.createElement('span');
    who.className = 'wish__who';
    who.textContent = w.display_name;
    const when = document.createElement('span');
    when.className = 'wish__when';
    when.textContent = new Date(w.created_at).toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }) + (w.approved ? ' · แสดงอยู่' : ' · รออนุมัติ');
    head.append(who, when);

    const msg = document.createElement('p');
    msg.className = 'wish__msg';
    msg.textContent = w.message;

    const act = document.createElement('div');
    act.className = 'wish__act';

    const toggle = document.createElement('button');
    toggle.className = 'btn';
    toggle.textContent = w.approved ? 'ซ่อน' : 'อนุมัติ';
    toggle.addEventListener('click', async () => {
      await sb.from('wishes').update({ approved: !w.approved }).eq('id', w.id);
      toast(w.approved ? 'ซ่อนแล้ว' : 'อนุมัติแล้ว');
      loadWishes();
    });

    const del = document.createElement('button');
    del.className = 'ghost ghost--danger';
    del.textContent = 'ลบ';
    del.addEventListener('click', async () => {
      if (!confirm('ลบคำอวยพรนี้ถาวรใช่ไหม')) return;
      await sb.from('wishes').delete().eq('id', w.id);
      toast('ลบแล้ว');
      loadWishes();
    });

    act.append(toggle, del);
    card.append(head, msg, act);
    box.appendChild(card);
  }
}

/* ================= guards ================= */

window.addEventListener('beforeunload', (e) => {
  if (dirty.size) { e.preventDefault(); e.returnValue = ''; }
});

boot();
