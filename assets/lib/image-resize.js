// Photos straight off a phone run 4–8 MB each. Fifty of those would eat the
// whole free storage tier, so every upload is resized and re-encoded in the
// browser before it ever leaves the device.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ไม่สามารถอ่านไฟล์รูปได้')); };
    img.src = url;
  });
}

export async function shrink(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  // Safari only got WebP encoding in 14; fall back rather than upload nothing.
  const type = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    ? 'image/webp' : 'image/jpeg';

  const blob = await new Promise(res => canvas.toBlob(res, type, QUALITY));
  if (!blob) throw new Error('แปลงไฟล์รูปไม่สำเร็จ');

  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return { blob, name, type, width: w, height: h };
}
