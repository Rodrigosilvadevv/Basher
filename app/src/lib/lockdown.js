// Trava a tela: sem pinça, sem duplo toque para zoom, sem arrastar a página para os lados.
// O mapa continua com zoom próprio (Leaflet usa eventos de toque, não os de "gesture").
export function lockdown() {
  const stop = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) =>
    document.addEventListener(ev, stop, { passive: false }),
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 && !e.target.closest?.('.leaflet-container')) e.preventDefault();
    },
    { passive: false },
  );

  let lastTouch = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouch < 300 && !e.target.closest?.('.leaflet-container, input, textarea')) e.preventDefault();
      lastTouch = now;
    },
    { passive: false },
  );

  // zoom de trackpad / ctrl+roda no desktop
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });

  // garante que a página nunca fica deslocada (ex.: depois do teclado do iOS)
  const reset = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); };
  window.addEventListener('scroll', reset, { passive: true });
  window.visualViewport?.addEventListener('resize', reset);
}
