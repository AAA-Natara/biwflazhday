// Landing page behaviour. Three things only: lay each piece of the collage
// down as it scrolls into view, open a photograph full size, and pull the
// couple's edits in from Supabase.

import { loadContent } from './content-loader.js?v=17';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- laying the pieces down -------------------------------- */

function revealOnScroll() {
  const pieces = document.querySelectorAll('.rise');
  if (reduce || !('IntersectionObserver' in window)) {
    pieces.forEach(el => el.classList.add('in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  pieces.forEach(el => io.observe(el));
}

/* ---------- photographs full size --------------------------------- */

function bindLightbox() {
  const box = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const close = document.getElementById('lightbox-close');
  const grid = document.querySelector('.gallery__grid');
  if (!box || !img || !grid) return;

  // The grid is built after the photos arrive, so the listener lives on the
  // grid rather than on each button.
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-full]');
    if (!btn) return;
    img.src = btn.dataset.full;
    box.showModal();
  });

  close.addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
  box.addEventListener('close', () => { img.src = ''; });
}

/* ---------- gentle anchors ---------------------------------------- */

function bindAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

/* ---------- section numbers --------------------------------------- */

// The gallery only appears once there are photographs to show, so the
// numbers are counted at run time rather than typed into the HTML. Nothing
// is worse than a page that reads 01, 02, 04.
function renumber() {
  let n = 0;
  for (const sec of document.querySelectorAll('main > section')) {
    const num = sec.querySelector('.head__num');
    if (!num || sec.hidden) continue;
    num.textContent = String(++n).padStart(2, '0');
  }
}

/* ---------- boot --------------------------------------------------- */

revealOnScroll();
bindLightbox();
bindAnchors();

renumber();

loadContent()
  .then(() => {
    renumber();
    // Anything the database added — gallery tiles, wishes — needs the same
    // treatment as the pieces that were in the HTML from the start.
    revealOnScroll();
  })
  .catch(err => console.warn('content unavailable', err));
