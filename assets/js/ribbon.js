// The page is wrapped like a gift: two ribbon bands run the full height down
// each side, and a bow is tied at the top. Paths are generated from the
// measured viewport so the SVG stays 1:1 with CSS pixels — no viewBox
// scaling, so a 1px stroke is always exactly 1px.

const NS = 'http://www.w3.org/2000/svg';

function band(tx, startY, endY, dx, amp, period) {
  const X = v => (v + dx).toFixed(1);
  let d = `M${X(tx)} ${startY}`;
  let y = startY, side = 1;
  while (y < endY - 4) {
    const ny = Math.min(y + period, endY);
    const cx = X(tx + side * amp);
    d += ` C${cx} ${(y + (ny - y) * 0.35).toFixed(1)} ${cx} ${(y + (ny - y) * 0.65).toFixed(1)} ${X(tx)} ${ny.toFixed(1)}`;
    y = ny;
    side *= -1;
  }
  return d;
}

function node(name, attrs) {
  const el = document.createElementNS(NS, name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

export function drawRibbon() {
  const svg = document.getElementById('ribbon');
  if (!svg) return;

  const W = document.documentElement.clientWidth;
  const H = Math.max(document.body.scrollHeight, window.innerHeight);
  const narrow = W < 560;

  const railX = narrow ? 20 : Math.round(W * 0.145);
  const w = narrow ? 11 : 17;
  const amp = narrow ? 6 : 10;
  const period = narrow ? 165 : 200;
  const endY = H - 70;
  const scale = Math.max(0.6, Math.min(1, W / 680));

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';

  const bands = node('g', {
    fill: 'none', stroke: 'var(--sky)', 'stroke-width': '1',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  });

  [railX, W - railX].forEach(tx => {
    bands.appendChild(node('path', { d: band(tx, -20, endY, -w / 2, amp, period) }));
    bands.appendChild(node('path', { d: band(tx, -20, endY, w / 2, amp, period) }));
    bands.appendChild(node('path', {
      d: `M${tx - w / 2} ${endY} L${tx} ${endY - 13} L${tx + w / 2} ${endY}`
    }));
  });
  svg.appendChild(bands);

  const bow = node('g', {
    transform: `translate(${W / 2} ${narrow ? 88 : 104}) scale(${scale.toFixed(3)})`,
    fill: 'var(--paper)', stroke: 'var(--sky)',
    'stroke-width': (1.1 / scale).toFixed(2),
    'stroke-linejoin': 'round', 'stroke-linecap': 'round'
  });
  // short tails first so the loops overlap them at the knot
  bow.appendChild(node('path', { d: 'M-8 6C-26 30 -34 58 -28 76L-16 66L-6 78C-2 58 0 30 -2 10Z' }));
  bow.appendChild(node('path', { d: 'M8 6C26 30 34 58 28 76L16 66L6 78C2 58 0 30 2 10Z' }));
  bow.appendChild(node('path', { d: 'M-6 -2C-28 -50 -66 -72 -94 -62C-122 -52 -118 -14 -82 -1C-58 7 -20 11 -6 -2Z' }));
  bow.appendChild(node('path', { d: 'M6 -2C28 -50 66 -72 94 -62C122 -52 118 -14 82 -1C58 7 20 11 6 -2Z' }));
  bow.appendChild(node('path', {
    d: 'M-12 -5C-40 -28 -66 -40 -86 -37', fill: 'none',
    stroke: 'var(--sky-light)', 'stroke-width': (0.8 / scale).toFixed(2)
  }));
  bow.appendChild(node('path', {
    d: 'M12 -5C40 -28 66 -40 86 -37', fill: 'none',
    stroke: 'var(--sky-light)', 'stroke-width': (0.8 / scale).toFixed(2)
  }));
  bow.appendChild(node('ellipse', { cx: 0, cy: 2, rx: 12, ry: 10 }));
  svg.appendChild(bow);
}

// On first paint the bands draw downward and the bow settles in, like a
// package being opened. Skipped entirely when reduced motion is requested.
export function animateRibbon() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = document.getElementById('ribbon');
  if (!svg) return;

  const bands = svg.querySelector('g');
  if (bands) {
    bands.querySelectorAll('path').forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.style.transition = 'stroke-dashoffset 1.7s cubic-bezier(.22,.61,.36,1)';
      requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; });
    });
  }

  const bow = svg.querySelector('g:last-of-type');
  if (bow) {
    bow.style.opacity = '0';
    bow.style.transition = 'opacity .9s ease .5s';
    requestAnimationFrame(() => { bow.style.opacity = '1'; });
  }
}
