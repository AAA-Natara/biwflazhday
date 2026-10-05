import { getAdminClient, isConfigured, STORAGE_BUCKET } from './supabase-client.js?v=14';
import { shrink } from '../lib/image-resize.js?v=14';

const $ = id => document.getElementById(id);
const dirty = new Map();          // key -> new value, for site_content only
let sb = null;

const SECTION_TITLES = {
  hero:      ['ชื่อบ่าวสาว',     'ใช้ทุกจุดบนเว็บและบนการ์ด'],
  opening:   ['หน้าเปิด',       'บรรทัดบนสุดและคำชวนให้เลื่อนลง'],
  maincard:  ['การ์ดสีเขียว',    'บรรทัดเหนือชื่อบนการ์ดใบใหญ่'],
  datecard:  ['ป้ายวันที่',      'วัน เลขวันที่ เดือน และสถานที่'],
  verse:     ['ข้อพระคัมภีร์',    'ข้อความและที่มา'],
  details:   ['รายละเอียดงาน',   'พิธี การแต่งกาย ที่จอดรถ และการเดินทาง'],
  schedule2: ['กำหนดการ',       'เวลาและรายละเอียดแต่ละช่วง'],
  labels:    ['ป้ายและหัวข้อ',    'คำบนปุ่มและหัวข้อแต่ละส่วน'],
  cardpage:  ['การ์ดเชิญส่วนตัว', 'ข้อความบนหน้าการ์ดที่ส่งให้แขกรายคน'],
  footer:    ['ท้ายหน้า',        'บรรทัดปิดท้าย'],
  event:     ['ข้อมูลเดิม',       'ยังใช้กับลิงก์แผนที่และปฏิทิน'],
  headings:  ['หัวข้อเดิม',       'ไม่ได้ใช้บนดีไซน์ใหม่แล้ว'],
  theme:     ['ข้อความเดิม',      'ไม่ได้ใช้บนดีไซน์ใหม่แล้ว'],
  travel:    ['ข้อความเดิม',      'ไม่ได้ใช้บนดีไซน์ใหม่แล้ว'],
  story:     ['ข้อความเดิม',      'ไม่ได้ใช้บนดีไซน์ใหม่แล้ว'],
  rsvp:      ['ข้อความเดิม',      'ไม่ได้ใช้บนดีไซน์ใหม่แล้ว'],
  card:      ['การ์ดเชิญส่วนตัว', 'ข้อความบนหน้าการ์ดที่ส่งให้แขกรายคน']
};

// The order the groups appear in, so the panel reads like the site rather
// than like the database. Anything not listed falls in after these.
const SECTION_ORDER = ['hero', 'opening', 'maincard', 'datecard', 'verse',
  'details', 'schedule2', 'labels', 'cardpage', 'footer'];

const FIELD_LABELS = {
  'card.hint': 'ข้อความบนซองก่อนเปิด',
  'card.to': 'คำขึ้นต้นก่อนชื่อแขก',
  'card.save': 'ปุ่มบันทึกการ์ด',
  'card.home': 'ปุ่มไปหน้ารายละเอียด',
  'card.rsvp_heading': 'หัวข้อส่วนตอบรับ',
  'card.deadline': 'บรรทัดกำหนดตอบรับ',
  'card.question': 'คำถาม',
  'card.yes': 'ปุ่มตอบว่ามา',
  'card.no': 'ปุ่มตอบว่าไม่สะดวก',
  'card.note_label': 'ป้ายช่องข้อความถึงบ่าวสาว',
  'card.submit': 'ปุ่มส่งคำตอบ',
  'open.eyebrow': 'บรรทัดบนสุด',
  'open.cue': 'คำชวนให้เลื่อนลง',
  'card.kicker': 'บรรทัดเหนือชื่อบนการ์ด',
  'date.weekday': 'วันในสัปดาห์',
  'date.day': 'เลขวันที่',
  'date.month': 'เดือนและปี',
  'date.place': 'สถานที่',
  'date.hour': 'เวลา',
  'verse.en': 'ข้อความ (อังกฤษ)',
  'verse.en_ref': 'อ้างอิง (อังกฤษ)',
  'det.ceremony_head': 'พิธี · หัวข้อ',
  'det.ceremony_body': 'พิธี · เนื้อหา',
  'det.dress_head': 'การแต่งกาย · หัวข้อ',
  'det.dress_body': 'การแต่งกาย · เนื้อหา',
  'det.parking_head': 'ที่จอดรถ · หัวข้อ',
  'det.parking_body': 'ที่จอดรถ · เนื้อหา',
  'det.transit_head': 'การเดินทาง · หัวข้อ',
  'det.transit_body': 'การเดินทาง · เนื้อหา',
  'lbl.details': 'ป้าย Details',
  'lbl.rsvp': 'ป้ายตอบรับ',
  'lbl.click': 'บรรทัดเล็กใต้ป้าย',
  'lbl.wishes': 'หัวข้อคำอวยพร',
  'lbl.schedule': 'หัวข้อกำหนดการ',
  'lbl.gallery': 'หัวข้อแกลเลอรี',
  'foot.note': 'บรรทัดขออภัย (ท้ายหน้าแรกเท่านั้น)',
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

// Order matters here: the list follows the order the sections appear on the
// page, not the alphabet, so the panel reads like the site.
const SETTING_ORDER = ['event_datetime', 'rsvp_deadline', 'show_slot_hints',
  'show_gallery', 'show_wishes'];

const SETTING_LABELS = {
  event_datetime:['วันเวลาจัดงาน',        'ใช้กับนาฬิกานับถอยหลังและปุ่มบันทึกลงปฏิทิน'],
  show_slot_hints:['แสดงกรอบช่องรูปที่ยังว่าง', 'เปิดไว้ตอนทำเว็บ จะเห็นว่าต้องใส่รูปอะไรตรงไหน ปิดก่อนส่งลิงก์ให้แขก แล้วช่องที่ยังว่างจะหายไปทั้งหมด'],
  show_gallery:  ['แสดงแกลเลอรี',         'ส่วน Gallery บนหน้าแรก ต้องมีรูปในแท็บรูปภาพอย่างน้อยหนึ่งรูป'],
  rsvp_deadline: ['กำหนดตอบรับ',           'รูปแบบ ปี-เดือน-วัน เช่น 2026-11-07'],
  show_wishes:   ['แสดงคำอวยพร',          'ส่วนรับคำอวยพรบนหน้าแรก']
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
  openTab('content');
  // Loaded up front so the tab counts are right before anything is clicked.
  loadReplies();
  loadWishes();
}

/* ================= tabs ================= */

const LOADERS = {
  content:  () => loadContent(),
  settings: () => loadSettings(),
  replies:  () => loadReplies(),
  guests:   () => loadGuests(),
  gallery:  () => { loadArt(); loadGallery('gallery'); },
  wishes:   () => loadWishes()
};

let currentTab = 'content';

function openTab(name) {
  currentTab = name;
  document.querySelectorAll('#tabs button')
    .forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab')
    .forEach(t => { t.hidden = t.id !== `tab-${name}`; });
  // Data is re-read on every visit: a reply that arrived while this page sat
  // open would otherwise stay invisible until a full reload.
  LOADERS[name]?.();
}

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  if (dirty.size && currentTab === 'content' &&
      !confirm('ยังมีข้อความที่แก้ค้างไว้และยังไม่บันทึก ออกจากแท็บนี้เลยไหม')) return;
  openTab(btn.dataset.tab);
});

$('refresh').addEventListener('click', () => {
  LOADERS[currentTab]?.();
  toast('อัปเดตข้อมูลแล้ว');
});

/* ================= content ================= */

async function loadContent() {
  const box = $('content-groups');
  const { data, error } = await sb.from('site_content')
    .select('key,value_th,field_type,section,sort_order')
    .order('section').order('sort_order');

  if (error || !data) { box.innerHTML = '<p class="dim">โหลดข้อความไม่สำเร็จ</p>'; return; }

  const groups = {};
  for (const row of data) (groups[row.section] ||= []).push(row);

  // Groups the new design uses come first, in page order. Leftovers from the
  // old design sort to the bottom rather than vanishing, so nothing the
  // couple already typed becomes unreachable.
  const rank = (n) => {
    const i = SECTION_ORDER.indexOf(n);
    return i === -1 ? 99 : i;
  };

  box.innerHTML = '';
  const sections = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  for (const [i, name] of sections.entries()) {
    const [title, hint] = SECTION_TITLES[name] || [name, ''];

    // Collapsed by default: sixty-odd fields in one scroll is unusable, and
    // the couple only ever edits one area at a time.
    const wrap = document.createElement('details');
    wrap.className = 'group';
    wrap.open = i === 0;

    const sum = document.createElement('summary');
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.className = 'group__hint';
    p.textContent = hint;
    sum.append(h, p);
    wrap.appendChild(sum);

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
  const { data } = await sb.from('site_settings').select('key,value');
  if (!data) { box.innerHTML = '<p class="dim">โหลดการตั้งค่าไม่สำเร็จ</p>'; return; }

  // Anything not in SETTING_ORDER is a leftover that no longer drives the
  // page, so it is not rendered at all.
  const rows = SETTING_ORDER
    .map(key => data.find(r => r.key === key))
    .filter(Boolean);

  box.innerHTML = '';
  for (const row of rows) {
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

/* ================= guests ================= */

const cardLink = slug => `${location.origin}${location.pathname.replace(/admin\/?$/, '')}card/?g=${slug}`;

let guestCache = [];

/* --- add sheet ---------------------------------------------------- */

const dialog = $('guest-dialog');

function openSheet() {
  $('guest-msg').textContent = '';
  dialog.showModal();
  $('g-name').focus();
}
function closeSheet() {
  dialog.close();
  for (const id of ['g-name', 'g-slug', 'g-group', 'g-msg']) $(id).value = '';
}
$('add-open').addEventListener('click', openSheet);
$('add-close').addEventListener('click', closeSheet);
$('add-cancel').addEventListener('click', closeSheet);

$('guest-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('guest-msg');
  const name_th = $('g-name').value.trim();
  if (!name_th) { msg.textContent = 'กรุณาใส่ชื่อ'; return; }

  // Exactly what was typed, lowercased. Nothing is generated or appended.
  const slug = $('g-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) { msg.textContent = 'กรุณาใส่ลิงก์'; return; }

  const btn = $('g-save');
  btn.disabled = true;
  msg.textContent = 'กำลังบันทึก…';

  const { error } = await sb.from('guests').insert({
    slug,
    name_th,
    message: $('g-msg').value.trim() || null,
    group_tag: $('g-group').value.trim() || null,
    seats: 1
  });
  btn.disabled = false;

  if (error) {
    msg.textContent = error.message.includes('duplicate')
      ? 'ลิงก์นี้ถูกใช้ไปแล้ว กรุณาเปลี่ยนเป็นชื่ออื่น'
      : 'บันทึกไม่สำเร็จ ' + error.message;
    return;
  }
  closeSheet();
  toast('เพิ่มรายชื่อแล้ว');
  loadGuests();
});

/* --- list --------------------------------------------------------- */

$('guest-search').addEventListener('input', () => renderGuests());

async function loadGuests() {
  const { data, error } = await sb.from('guests')
    .select('id,slug,name_th,message,group_tag,rsvp(attending)')
    .order('created_at', { ascending: false });

  if (error) { $('guest-list').innerHTML = '<p class="dim">โหลดรายชื่อไม่สำเร็จ</p>'; return; }
  guestCache = data || [];
  renderGuests();
}

function renderGuests() {
  const box = $('guest-list');
  const q = $('guest-search').value.trim().toLowerCase();

  const rows = guestCache.filter(g =>
    !q || [g.name_th, g.slug, g.group_tag].filter(Boolean).join(' ').toLowerCase().includes(q));

  $('guest-summary').textContent = q
    ? `พบ ${rows.length} จาก ${guestCache.length} รายชื่อ`
    : `ทั้งหมด ${guestCache.length} รายชื่อ`;

  box.innerHTML = '';
  if (!rows.length) {
    box.innerHTML = `<p class="dim" style="padding:18px">${q ? 'ไม่พบรายชื่อที่ค้นหา' : 'ยังไม่มีรายชื่อ'}</p>`;
    return;
  }

  for (const g of rows) {
    const r = Array.isArray(g.rsvp) ? g.rsvp[0] : g.rsvp;

    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'row__name';
    name.textContent = g.name_th;

    const pill = document.createElement('span');
    pill.className = 'pill ' + (r ? (r.attending ? 'pill--yes' : 'pill--no') : 'pill--wait');
    pill.textContent = r ? (r.attending ? 'มา' : 'ไม่สะดวก') : 'รอตอบ';
    name.appendChild(pill);

    const meta = document.createElement('div');
    meta.className = 'row__meta';
    meta.textContent = [g.slug, g.group_tag, g.message].filter(Boolean).join(' · ');
    left.append(name, meta);

    const act = document.createElement('div');
    act.className = 'row__act';

    const copy = document.createElement('button');
    copy.className = 'ghost';
    copy.textContent = 'คัดลอกลิงก์';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cardLink(g.slug)); toast('คัดลอกลิงก์แล้ว'); }
      catch { prompt('คัดลอกลิงก์นี้', cardLink(g.slug)); }
    });

    const open = document.createElement('a');
    open.className = 'ghost';
    open.textContent = 'เปิด';
    open.target = '_blank';
    open.rel = 'noopener';
    open.href = cardLink(g.slug);

    const del = document.createElement('button');
    del.className = 'ghost ghost--danger';
    del.textContent = 'ลบ';
    del.addEventListener('click', async () => {
      if (!confirm(`ลบ ${g.name_th} ถาวรใช่ไหม การตอบรับของคนนี้จะหายไปด้วย`)) return;
      await sb.from('guests').delete().eq('id', g.id);
      toast('ลบแล้ว');
      loadGuests();
    });

    act.append(copy, open, del);
    row.append(left, act);
    box.appendChild(row);
  }
}

/* ================= replies ================= */

// Read-only view of who is coming. Kept apart from the guest list so that
// checking a reply never sits next to a delete button.
async function loadReplies() {
  const box = $('replies-list');
  const tally = $('tally');
  const { data, error } = await sb.from('guests')
    .select('id,name_th,group_tag,rsvp(attending,note,responded_at)')
    .order('name_th');

  if (error || !data) { box.innerHTML = '<p class="dim">โหลดข้อมูลไม่สำเร็จ</p>'; return; }

  const reply = g => (Array.isArray(g.rsvp) ? g.rsvp[0] : g.rsvp) || null;
  const yes = data.filter(g => reply(g)?.attending);
  const no = data.filter(g => reply(g) && !reply(g).attending);
  const wait = data.filter(g => !reply(g));

  tally.innerHTML = '';
  [['yes', yes.length, 'มาร่วมงาน'], ['no', no.length, 'ไม่สะดวก'], ['wait', wait.length, 'ยังไม่ตอบ']]
    .forEach(([cls, n, label]) => {
      const d = document.createElement('div');
      d.className = cls;
      const b = document.createElement('b');
      b.textContent = n;
      const s = document.createElement('span');
      s.textContent = label;
      d.append(b, s);
      tally.appendChild(d);
    });

  badge('replies', `${yes.length}/${data.length}`);

  box.innerHTML = '';
  if (!data.length) { box.innerHTML = '<p class="dim">ยังไม่มีรายชื่อแขก</p>'; return; }

  const section = (title, rows, showWhen) => {
    if (!rows.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'rgroup';
    const h = document.createElement('h3');
    h.textContent = `${title} · ${rows.length} คน`;
    const ul = document.createElement('ul');

    for (const g of rows) {
      const r = reply(g);
      const li = document.createElement('li');

      const line = document.createElement('div');
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = g.name_th;
      line.appendChild(who);

      if (showWhen && r?.responded_at) {
        const when = document.createElement('span');
        when.className = 'when';
        when.textContent = new Date(r.responded_at).toLocaleDateString('th-TH', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        line.appendChild(when);
      }
      if (g.group_tag) {
        const tag = document.createElement('span');
        tag.className = 'src';
        tag.textContent = g.group_tag;
        line.appendChild(tag);
      }
      li.appendChild(line);

      if (r?.note) {
        const said = document.createElement('p');
        said.className = 'said';
        said.textContent = r.note;
        li.appendChild(said);
      }
      ul.appendChild(li);
    }
    wrap.append(h, ul);
    box.appendChild(wrap);
  };

  section('มาร่วมงาน', yes, true);
  section('ไม่สะดวก', no, true);
  section('ยังไม่ตอบ', wait, false);
}

/* ================= named art slots ================= */

// A slot holds exactly one picture. Uploading again replaces what was there,
// so the couple can never end up with two wax seals arguing over one spot.
const ART_SLOTS = [
  ['env_closed', 'ซองจดหมาย (ปิดผนึก)', 'ถ่ายซองจริงแนวนอน 3:2 ถ้าไม่ใส่ เว็บจะวาดซองให้เอง', false],
  ['env_open',   'ซองจดหมาย (เปิดแล้ว)', 'ซองใบเดิม ถ่ายตอนเปิด แนวนอน 3:2', false],
  ['seal',       'ตราครั่ง',             'PNG พื้นหลังโปร่งใส ถ้าไม่ใส่ เว็บจะวาดตราให้เอง', true],
  ['floral_1',   'ช่อดอกไม้ 1',          'PNG โปร่งใส วางมุมซ้ายล่างของซอง', true],
  ['floral_2',   'ช่อดอกไม้ 2',          'PNG โปร่งใส วางมุมขวาบนของซอง', true],
  ['floral_3',   'ช่อดอกไม้ใหญ่',        'PNG โปร่งใส วางท้ายหน้า', true],
  ['liner',      'รูปในฝาซอง',           'รูปคู่แนวนอน 4:3', false],
  ['couple_1',   'รูปคู่ในกรอบโพลารอยด์', 'แนวตั้ง 4:5', false],
  ['couple_2',   'รูปคู่ใบที่สอง',        'แนวตั้ง 4:5 อยู่ใต้กำหนดการ', false]
];

let artRows = new Map();

async function loadArt() {
  const box = $('art-list');
  const { data } = await sb.from('gallery')
    .select('id,storage_path,slot').eq('kind', 'art');

  artRows = new Map((data || []).filter(r => r.slot).map(r => [r.slot, r]));

  box.innerHTML = '';
  for (const [slot, title, hint, cut] of ART_SLOTS) {
    const row = artRows.get(slot);

    const card = document.createElement('div');
    card.className = 'artcard';

    const frame = document.createElement('div');
    frame.className = 'artcard__frame' + (cut ? ' artcard__frame--cut' : '');
    if (row) {
      const img = document.createElement('img');
      img.src = sb.storage.from(STORAGE_BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
      img.alt = '';
      img.loading = 'lazy';
      frame.appendChild(img);
    } else {
      const em = document.createElement('span');
      em.textContent = 'ยังว่าง';
      frame.appendChild(em);
    }

    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = hint;

    const bar = document.createElement('div');
    bar.className = 'artcard__bar';

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'btn';
    pick.textContent = row ? 'เปลี่ยนรูป' : 'เลือกรูป';
    pick.addEventListener('click', () => pickArt(slot, cut));
    bar.appendChild(pick);

    if (row) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'ghost ghost--danger';
      del.textContent = 'ลบ';
      del.addEventListener('click', () => removeArt(row));
      bar.appendChild(del);
    }

    const msg = document.createElement('p');
    msg.className = 'dim';
    msg.id = `art-msg-${slot}`;

    card.append(frame, h, p, bar, msg);
    box.appendChild(card);
  }
}

// One hidden file input is reused by every slot; the slot it was opened for
// is remembered here rather than in nine separate inputs.
let artTarget = null;

function pickArt(slot, cut) {
  artTarget = { slot, cut };
  const input = $('art-input');
  input.value = '';
  input.click();
}

$('art-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !artTarget) return;
  const { slot, cut } = artTarget;
  const msg = $(`art-msg-${slot}`);
  msg.textContent = 'กำลังอัปโหลด…';

  try {
    // Cut-outs keep their transparency; photographs do not need it.
    const { blob, name, type } = await shrink(file, { keepAlpha: cut });
    const path = `art/${slot}/${name}`;
    const { error: upErr } = await sb.storage.from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: type, cacheControl: '31536000' });
    if (upErr) throw upErr;

    const existing = artRows.get(slot);
    if (existing) {
      const { error } = await sb.from('gallery')
        .update({ storage_path: path }).eq('id', existing.id);
      if (error) throw error;
      // The old file is only removed once the row points at the new one, so a
      // failure halfway through never leaves the page with a dead image.
      await sb.storage.from(STORAGE_BUCKET).remove([existing.storage_path]);
    } else {
      const { error } = await sb.from('gallery')
        .insert({ storage_path: path, kind: 'art', slot, sort_order: 0 });
      if (error) throw error;
    }

    toast('อัปโหลดแล้ว');
    loadArt();
  } catch (err) {
    console.warn(err);
    msg.textContent = 'อัปโหลดไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ');
  }
});

async function removeArt(row) {
  if (!confirm('ลบรูปในช่องนี้ใช่ไหม')) return;
  await sb.from('gallery').delete().eq('id', row.id);
  await sb.storage.from(STORAGE_BUCKET).remove([row.storage_path]);
  toast('ลบแล้ว');
  loadArt();
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

bindUploader('file-input', 'upload-msg', 'gallery');

/* ================= wishes ================= */

function badge(tab, text) {
  const btn = document.querySelector(`#tabs button[data-tab="${tab}"]`);
  if (!btn) return;
  let el = btn.querySelector('.badge');
  if (!el) {
    el = document.createElement('span');
    el.className = 'badge';
    btn.appendChild(el);
  }
  el.textContent = text;
}

async function loadWishes() {
  const box = $('wishes-list');
  const { data } = await sb.from('wishes')
    .select('id,display_name,message,approved,created_at,source')
    .order('approved').order('created_at', { ascending: false });

  if (!data || !data.length) {
    box.innerHTML = '<p class="dim">ยังไม่มีคำอวยพร</p>';
    badge('wishes', '');
    return;
  }

  const pending = data.filter(w => !w.approved).length;
  badge('wishes', pending ? `${pending} รอ` : '');

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

    if (w.source === 'rsvp') {
      const src = document.createElement('span');
      src.className = 'src';
      src.textContent = 'จากการ์ดเชิญ';
      head.appendChild(src);
    }

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
