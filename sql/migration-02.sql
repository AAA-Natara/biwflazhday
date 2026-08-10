-- biwflazhday.online — migration 02
-- Run this once in the Supabase SQL editor. Safe to run twice.

-- 1. A personal line of invitation for each guest.
alter table public.guests add column if not exists message text;

-- 2. The card now returns that line, and reports what the guest answered
--    so a returning visitor sees their own choice already selected.
create or replace function public.get_guest_by_slug(p_slug text)
returns table (name_th text, name_en text, title text, message text, has_replied boolean, attending boolean)
language sql stable security definer set search_path = public
as $$
  select g.name_th, g.name_en, g.title, g.message,
         exists (select 1 from public.rsvp r where r.guest_id = g.id),
         (select r.attending from public.rsvp r where r.guest_id = g.id)
  from public.guests g
  where g.slug = p_slug
  limit 1;
$$;

-- 3. A personal card asks one question: are you coming. No seat counting,
--    and no global switch that can silently close it.
create or replace function public.submit_rsvp(
  p_slug text, p_attending boolean, p_party_size int, p_note text
) returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_guest_id uuid;
begin
  select id into v_guest_id from public.guests where slug = p_slug;

  if v_guest_id is null then
    raise exception 'guest_not_found';
  end if;

  insert into public.rsvp (guest_id, attending, party_size, note)
  values (v_guest_id, p_attending, case when p_attending then 1 else 0 end,
          nullif(trim(p_note), ''))
  on conflict (guest_id) do update
    set attending = excluded.attending,
        party_size = excluded.party_size,
        note = excluded.note,
        responded_at = now();
  return true;
end;
$$;

grant execute on function public.get_guest_by_slug(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, boolean, int, text) to anon, authenticated;

-- 4. Two switches that no longer drive anything on the page.
delete from public.site_settings where key in ('show_gift', 'rsvp_open');
