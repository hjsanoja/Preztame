// Freezes the page behind an open dialog. Counted, so nested dialogs (a
// confirmation over a sheet) keep the page frozen until the last one closes.
// position: fixed is what stops iOS Safari from scrolling the page anyway.
let locks = 0;
let savedY = 0;

export function lockScroll() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  const s = document.body.style;
  s.position = 'fixed';
  s.top = `-${savedY}px`;
  s.left = '0';
  s.right = '0';
  s.width = '100%';
}

export function unlockScroll() {
  if (locks === 0 || --locks > 0) return;
  const s = document.body.style;
  s.position = s.top = s.left = s.right = s.width = '';
  window.scrollTo(0, savedY);
}
