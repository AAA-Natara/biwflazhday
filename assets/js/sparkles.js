// Fairy dust. A fixed layer of tiny four-point sparkles that drift upward and
// twinkle out of phase with each other, so the page never looks like a loop.
//
// Deliberately small in number: at this size the effect reads as light catching
// something, and past roughly two dozen it starts to read as snow.

const SPARKLE = 'M12 0C13.1 8.2 15.8 10.9 24 12C15.8 13.1 13.1 15.8 12 24C10.9 15.8 8.2 13.1 0 12C8.2 10.9 10.9 8.2 12 0Z';
const TINTS = ['var(--sky)', 'var(--rose)', 'var(--nude-deep)'];

const rand = (min, max) => min + Math.random() * (max - min);

export function startSparkles() {
  const layer = document.getElementById('sparkles');
  if (!layer) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const wide = window.innerWidth >= 640;
  const count = wide ? 22 : 12;
  layer.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const size = rand(5, 14);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'sparkle');
    svg.style.width = `${size.toFixed(1)}px`;
    svg.style.left = `${rand(2, 96).toFixed(1)}%`;
    svg.style.top = `${rand(4, 98).toFixed(1)}%`;

    // Two independent cycles: a long slow rise, and a short twinkle. Giving
    // each its own duration and delay keeps any two sparkles from syncing up.
    svg.style.setProperty('--rise', `${rand(15, 26).toFixed(1)}s`);
    svg.style.setProperty('--rise-delay', `${rand(-26, 0).toFixed(1)}s`);
    svg.style.setProperty('--twinkle', `${rand(3.2, 6.4).toFixed(1)}s`);
    svg.style.setProperty('--twinkle-delay', `${rand(-6, 0).toFixed(1)}s`);
    svg.style.setProperty('--sway', `${rand(-26, 26).toFixed(0)}px`);
    svg.style.setProperty('--peak', rand(0.42, 0.88).toFixed(2));

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', SPARKLE);
    path.setAttribute('fill', TINTS[i % TINTS.length]);
    svg.appendChild(path);

    layer.appendChild(svg);
  }
}

// Re-scatter on a real resize so the density suits the new width. Ignores the
// height-only changes that mobile browsers fire when the address bar hides.
let lastWidth = window.innerWidth;
let resizeTimer;
window.addEventListener('resize', () => {
  if (Math.abs(window.innerWidth - lastWidth) < 60) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(startSparkles, 220);
});
