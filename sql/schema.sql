-- biwflazhlove.space — Supabase schema
-- Worawan (Biw) & Chat (Flazh) · 21 November 2026
-- Run top to bottom in the Supabase SQL editor.

-- ---------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner','editor')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key        text primary key,
  value_th   text,
  value_en   text,
  field_type text not null default 'text' check (field_type in ('text','textarea')),
  section    text not null default 'general',
  sort_order int  not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

create table if not exists public.guests (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name_th    text not null,
  name_en    text,
  title      text default 'คุณ',
  side       text default 'both' check (side in ('biw','flazh','both')),
  seats      int  not null default 1,
  group_tag  text,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvp (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid unique references public.guests(id) on delete cascade,
  attending    boolean not null,
  party_size   int not null default 1,
  note         text,
  responded_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid references public.guests(id) on delete set null,
  display_name text not null,
  message      text not null,
  approved     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.gallery (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  caption      text,
  kind         text not null default 'gallery' check (kind in ('hero','gallery')),
  sort_order   int not null default 0,
  is_visible   boolean not null default true,
  created_at   timestamptz not null default now()
);

-- For projects created before the hero slideshow existed.
alter table public.gallery add column if not exists kind text not null default 'gallery';
do $$ begin
  alter table public.gallery add constraint gallery_kind_check check (kind in ('hero','gallery'));
exception when duplicate_object then null; end $$;

create table if not exists public.card_views (
  id       bigserial primary key,
  guest_id uuid references public.guests(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_wishes_approved on public.wishes (approved, created_at desc);
create index if not exists idx_gallery_order   on public.gallery (kind, is_visible, sort_order);

-- ---------------------------------------------------------------
-- 2. Helper
-- ---------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------
-- 3. RLS
-- The anon key ships inside a static site, so anon gets the minimum:
-- read-only on public copy, and no direct reach into the guest list.
-- ---------------------------------------------------------------

alter table public.admin_users   enable row level security;
alter table public.site_content  enable row level security;
alter table public.site_settings enable row level security;
alter table public.guests        enable row level security;
alter table public.rsvp          enable row level security;
alter table public.wishes        enable row level security;
alter table public.gallery       enable row level security;
alter table public.card_views    enable row level security;

create policy "content readable" on public.site_content
  for select using (true);
create policy "content writable by admin" on public.site_content
  for all using (public.is_admin()) with check (public.is_admin());

create policy "settings readable" on public.site_settings
  for select using (true);
create policy "settings writable by admin" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "gallery readable when visible" on public.gallery
  for select using (is_visible);
create policy "gallery writable by admin" on public.gallery
  for all using (public.is_admin()) with check (public.is_admin());

create policy "approved wishes readable" on public.wishes
  for select using (approved);
create policy "wishes managed by admin" on public.wishes
  for all using (public.is_admin()) with check (public.is_admin());

-- No anon policy on guests, rsvp, card_views at all.
-- Anything a visitor needs goes through the security-definer functions below.
create policy "guests managed by admin" on public.guests
  for all using (public.is_admin()) with check (public.is_admin());
create policy "rsvp readable by admin" on public.rsvp
  for all using (public.is_admin()) with check (public.is_admin());
create policy "card views readable by admin" on public.card_views
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin list readable by admin" on public.admin_users
  for select using (public.is_admin());

-- ---------------------------------------------------------------
-- 4. Public RPC surface
-- ---------------------------------------------------------------

-- Returns one guest by slug, and only the fields the card needs.
create or replace function public.get_guest_by_slug(p_slug text)
returns table (name_th text, name_en text, title text, seats int, has_replied boolean)
language sql stable security definer set search_path = public
as $$
  select g.name_th, g.name_en, g.title, g.seats,
         exists (select 1 from public.rsvp r where r.guest_id = g.id)
  from public.guests g
  where g.slug = p_slug
  limit 1;
$$;

create or replace function public.log_card_view(p_slug text)
returns void
language sql volatile security definer set search_path = public
as $$
  insert into public.card_views (guest_id)
  select id from public.guests where slug = p_slug;
$$;

-- Upsert an RSVP without ever exposing guest_id to the browser.
create or replace function public.submit_rsvp(
  p_slug text, p_attending boolean, p_party_size int, p_note text
) returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_guest_id uuid;
  v_seats    int;
  v_open     boolean;
begin
  select coalesce((select value = 'true' from public.site_settings where key = 'rsvp_open'), true)
  into v_open;
  if not v_open then
    raise exception 'rsvp_closed';
  end if;

  select id, seats into v_guest_id, v_seats
  from public.guests where slug = p_slug;

  if v_guest_id is null then
    raise exception 'guest_not_found';
  end if;

  if p_party_size < 1 or p_party_size > greatest(v_seats, 1) then
    raise exception 'party_size_out_of_range';
  end if;

  insert into public.rsvp (guest_id, attending, party_size, note)
  values (v_guest_id, p_attending, case when p_attending then p_party_size else 0 end,
          nullif(trim(p_note), ''))
  on conflict (guest_id) do update
    set attending = excluded.attending,
        party_size = excluded.party_size,
        note = excluded.note,
        responded_at = now();
  return true;
end;
$$;

-- Wishes arrive unapproved and stay invisible until an admin releases them.
create or replace function public.submit_wish(
  p_display_name text, p_message text, p_slug text default null
) returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_guest_id uuid;
begin
  if length(trim(coalesce(p_display_name,''))) = 0 then
    raise exception 'name_required';
  end if;
  if length(trim(coalesce(p_message,''))) = 0 or length(p_message) > 600 then
    raise exception 'message_invalid';
  end if;

  if p_slug is not null then
    select id into v_guest_id from public.guests where slug = p_slug;
  end if;

  insert into public.wishes (guest_id, display_name, message)
  values (v_guest_id, trim(p_display_name), trim(p_message));
  return true;
end;
$$;

revoke all on function public.get_guest_by_slug(text) from public;
revoke all on function public.submit_rsvp(text, boolean, int, text) from public;
revoke all on function public.submit_wish(text, text, text) from public;
revoke all on function public.log_card_view(text) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_guest_by_slug(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, boolean, int, text) to anon, authenticated;
grant execute on function public.submit_wish(text, text, text) to anon, authenticated;
grant execute on function public.log_card_view(text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 5. Seed
-- Every string on the landing page lives here so the couple can edit it.
-- ---------------------------------------------------------------

insert into public.site_settings (key, value) values
  ('show_story',    'false'),
  ('show_gallery',  'false'),
  ('show_gift',     'false'),
  ('show_wishes',   'true'),
  ('rsvp_open',     'true'),
  ('rsvp_deadline', '2026-11-07'),
  ('event_datetime','2026-11-21T14:00:00+07:00')
on conflict (key) do nothing;

insert into public.site_content (key, value_th, field_type, section, sort_order) values
  ('hero.eyebrow',    'the wedding of',              'text',     'hero',     10),
  ('hero.bride_first','WORAWAN',                     'text',     'hero',     20),
  ('hero.bride_last', 'SONGTHONGTHAM',               'text',     'hero',     30),
  ('hero.groom_first','CHAT',                        'text',     'hero',     40),
  ('hero.groom_last', 'LEESAKUL',                    'text',     'hero',     50),

  ('verse.text',      'ความรักนั้นก็อดทนนานและกระทำคุณให้ ความรักไม่อิจฉา ไม่อวดตัว ไม่หยิ่งผยอง', 'textarea', 'verse', 10),
  ('verse.ref',       '1 โครินธ์ 13:4',               'text',     'verse',    20),

  ('sec.1_num',       '01',                          'text',     'headings', 10),
  ('sec.1_en',        'The Day',                     'text',     'headings', 11),
  ('sec.1_th',        'วันงาน',                       'text',     'headings', 12),
  ('sec.2_num',       '02',                          'text',     'headings', 20),
  ('sec.2_en',        'Schedule',                    'text',     'headings', 21),
  ('sec.2_th',        'กำหนดการ',                     'text',     'headings', 22),
  ('sec.3_num',       '03',                          'text',     'headings', 30),
  ('sec.3_en',        'Dress Code',                  'text',     'headings', 31),
  ('sec.3_th',        'สีของงาน',                     'text',     'headings', 32),
  ('sec.4_num',       '04',                          'text',     'headings', 40),
  ('sec.4_en',        'Getting There',               'text',     'headings', 41),
  ('sec.4_th',        'การเดินทาง',                    'text',     'headings', 42),
  ('sec.7_en',        'RSVP',                        'text',     'headings', 70),
  ('sec.8_num',       '05',                          'text',     'headings', 80),
  ('sec.8_en',        'Wishes',                      'text',     'headings', 81),
  ('sec.8_th',        'คำอวยพร',                      'text',     'headings', 82),

  ('event.weekday',   'SATURDAY',                    'text',     'event',    10),
  ('event.day_num',   '21',                          'text',     'event',    20),
  ('event.month',     'NOVEMBER 2026',               'text',     'event',    30),
  ('event.date',      'วันเสาร์ที่ 21 พฤศจิกายน 2569',    'text',     'event',    40),
  ('event.venue',     'คริสตจักรเมืองทอง',              'text',     'event',    50),
  ('event.address',   'ถนนแจ้งวัฒนะ อำเภอปากเกร็ด จังหวัดนนทบุรี', 'text', 'event', 60),
  ('event.time',      'พิธีสมรส เวลา 14:00 น.',        'text',     'event',    70),
  ('event.map_url',   'https://maps.google.com/?q=คริสตจักรเมืองทอง', 'text', 'event', 80),

  ('schedule.1_time', '13:30',                       'text',     'schedule', 10),
  ('schedule.1_text', 'แขกลงทะเบียนและเข้านั่งในห้องประชุม', 'text',  'schedule', 20),
  ('schedule.2_time', '14:00',                       'text',     'schedule', 30),
  ('schedule.2_text', 'พิธีสมรสเริ่ม กรุณามาถึงก่อนเวลา',  'text',     'schedule', 40),
  ('schedule.3_time', '15:30',                       'text',     'schedule', 50),
  ('schedule.3_text', 'ถ่ายภาพร่วมกับคู่บ่าวสาวและรับของที่ระลึก', 'text', 'schedule', 60),

  ('theme.note',      'ขอเชิญร่วมแต่งกายในโทนสีของงาน',   'textarea', 'theme',    10),

  ('travel.1_head',   'ที่จอดรถ',                      'text',     'travel',   10),
  ('travel.1_text',   'มีที่จอดรถภายในบริเวณคริสตจักร กรุณาเผื่อเวลาสำหรับการหาที่จอดในวันงาน', 'textarea', 'travel', 20),
  ('travel.2_head',   'รถสาธารณะ',                     'text',     'travel',   30),
  ('travel.2_text',   'สามารถเดินทางด้วยรถไฟฟ้าสายสีชมพู แล้วต่อรถรับจ้างเข้าสู่คริสตจักร', 'textarea', 'travel', 40),

  ('story.body',      'เรื่องราวของเราเริ่มต้นในวันที่ธรรมดาที่สุด และค่อย ๆ กลายเป็นสิ่งที่เราไม่อาจอธิบายได้ด้วยคำใดคำหนึ่ง — แก้ข้อความนี้ได้ที่หลังบ้าน', 'textarea', 'story', 10),

  ('rsvp.note',       'การตอบรับสามารถทำได้จากลิงก์การ์ดเชิญส่วนตัวที่ท่านได้รับ หากยังไม่ได้รับลิงก์ กรุณาติดต่อเจ้าภาพ', 'textarea', 'rsvp', 10),

  ('footer.apology',  '( ขออภัยหากมิได้มาเรียนเชิญด้วยตัวเอง )', 'text', 'footer', 10),
  ('footer.signoff',  'Worawan & Chat · 21.11.2026', 'text',     'footer',   20)
on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- 6. Storage policies for the wedding-media bucket
-- Create the bucket first (Storage -> New bucket -> wedding-media, public).
-- ---------------------------------------------------------------

create policy "wedding media readable" on storage.objects
  for select using (bucket_id = 'wedding-media');

create policy "wedding media writable by admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wedding-media' and public.is_admin());

create policy "wedding media removable by admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wedding-media' and public.is_admin());
