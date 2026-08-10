// Supabase is loaded lazily. If the CDN is unreachable, the credentials are
// still placeholders, or the page is being previewed offline, getClient()
// returns null and every caller falls back to the copy already in the HTML.
// Nothing on the landing page is allowed to depend on this succeeding.

export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
export const STORAGE_BUCKET = 'wedding-media';

let clientPromise = null;

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

export async function publicImageUrl(path) {
  const sb = await getClient();
  if (!sb) return '';
  return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
