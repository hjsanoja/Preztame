import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

// Keeps keyboard focus inside a dialog while it is open, focuses its first
// field (or the dialog itself) on open, and returns focus to whatever was
// focused before when it closes.
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container: HTMLElement | null = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;

    const items = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((el: HTMLElement) => el.offsetParent !== null || el === document.activeElement);

    const first = container.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]), textarea, select') ?? items()[0];
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    (first ?? container).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const head = list[0];
      const tail = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === head || document.activeElement === container)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
