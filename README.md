# biwflazhday.online

Wedding site for Worawan (Biw) & Chat (Flazh) — Saturday 21 November 2026,
Muangthong Church, 14:00.

Static front end on GitHub Pages, Supabase for content, guests, RSVP and wishes.

## Layout

    index.html              landing page (all copy present as defaults)
    card/                   per-guest invitation card  (next)
    admin/                  content, gallery, guests, RSVP  (next)
    assets/css/style.css    palette, type scale, components
    assets/js/ribbon.js     generates the bow + side bands at runtime
    assets/js/main.js       countdown, reveal, RSVP, wishes
    sql/schema.sql          tables, RLS, RPC, seed content

## Previewing locally

Do **not** open `index.html` by double-clicking it. Browsers block ES modules
over `file://`, so `main.js` never runs and the ribbon never draws. Serve it:

    cd biwflazhlove
    python3 -m http.server 8000
    # then open http://localhost:8000

Until `assets/js/supabase-client.js` has real credentials the page runs in
offline mode: all copy comes from the defaults in `index.html`, the ribbon and
countdown work, and the forms report that the database is not connected.

## Setup

1. Create the Supabase project, run `sql/schema.sql` in the SQL editor.
2. Create a public storage bucket named `wedding-media`.
3. Put the project URL and anon key in `assets/js/supabase-client.js`.
4. In Authentication settings, turn **email signup off**, then create the
   three admin accounts by hand and insert their `user_id` into `admin_users`.
5. Push to GitHub, enable Pages, point DNS:
   - apex `biwflazhday.online` -> four A records at GitHub's IPs
   - `www` -> CNAME to `<user>.github.io`
   Wait for DNS to propagate **before** enabling Enforce HTTPS.

## Design

Palette: paper `#FDFBF7`, nude `#E5D3C2`, sky `#AEC6DA`, rose `#D6A2AC`,
ink `#5E2730`. Light mode only — inverting the paper loses the whole idea.

Type: Cormorant Garamond for Latin (italic reserved for connecting words),
Trirong for Thai. Sarabun is deliberately avoided; it is the Thai government
document standard and reads as officialdom no matter how it is set.

Section order follows the printed invitation: names, date, venue, time, theme,
RSVP, apology line. Story and gallery are optional and default to hidden via
`site_settings`.
