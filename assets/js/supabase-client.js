// Supabase is loaded lazily. If the CDN is unreachable, the credentials are
// still placeholders, or the page is being previewed offline, getClient()
// returns null and every caller falls back to the copy already in the HTML.
// Nothing on the landing page is allowed to depend on this succeeding.

export const SUPABASE_URL = 'https://stzgbqyqrdlhjqzfcsgz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0emdicXlxcmRsaGpxemZjc2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjEwMjUsImV4cCI6MjEwMTkzNzAyNX0.B2u0m4swH70qgMjuJPrqBE2e6-GAiIYcSm5L-KtmRPI';
export const STORAGE_BUCKET = 'wedding-media';

let clientPromise = null;
let adminPromise = null;

export const isConfigured = () =>
  !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');

export function getClient() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }))
      .catch(err => {
        console.warn('supabase unavailable', err);
        return null;
      });
  }
  return clientPromise;
}

// The admin panel needs a session that survives a page reload, so it gets
// its own client. The public pages deliberately keep persistSession off.
export function getAdminClient() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!adminPromise) {
    adminPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true }
        }))
      .catch(err => { console.warn('supabase unavailable', err); return null; });
  }
  return adminPromise;
}

export async function publicImageUrl(path) {
  const sb = await getClient();
  if (!sb) return '';
  return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
