-- biwflazhday.online — migration 05
-- The RSVP note is gone from the public page: answering happens on the
-- personal card, so a public explainer only invited questions.
delete from public.site_content where key in ('rsvp.note', 'sec.7_en');
