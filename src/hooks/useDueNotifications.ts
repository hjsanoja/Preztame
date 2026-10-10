import { useCallback, useEffect, useState } from 'react';
import { Debt } from '../types';
import { dueDigest } from '../lib/reminders';

const PREF_KEY = 'df_notify';
const DAY_KEY = 'df_notified_day';
const META_CACHE = 'df-meta';
const SYNC_TAG = 'df-due-check';

export type NotifyState = 'unsupported' | 'off' | 'on' | 'blocked';

const supported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
const todayKey = () => new Date().toISOString().slice(0, 10);

function readState(): NotifyState {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  let pref = false;
  try { pref = localStorage.getItem(PREF_KEY) === '1'; } catch {}
  return pref && Notification.permission === 'granted' ? 'on' : 'off';
}

// Saves the pending-loans summary where the service worker can read it.
async function saveDueSnapshot(deudas: Debt[], enabled: boolean) {
  if (!('caches' in window)) return;
  const items = deudas
    .filter(d => d.estado === 'pendiente' && d.saldo > 0)
    .map(d => ({ contacto: d.contacto.trim(), saldo: d.saldo, mesPago: d.mesPago }));
  const cache = await caches.open(META_CACHE);
  await cache.put('/__df/due.json', new Response(JSON.stringify({ enabled, items, updatedAt: Date.now() }), { headers: { 'Content-Type': 'application/json' } }));
}

// Device notifications for overdue / soon-due loans:
// - once a day when the app opens (any browser that supports notifications);
// - in the background on Android with the app installed (periodic sync).
export function useDueNotifications(deudas: Debt[], ready: boolean) {
  const [state, setState] = useState<NotifyState>(readState);
  const [background, setBackground] = useState(false);

  // Keep the service worker's copy of pending loans up to date.
  useEffect(() => {
    if (!ready || state === 'unsupported') return;
    const t = setTimeout(() => { void saveDueSnapshot(deudas, state === 'on').catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [deudas, ready, state]);

  // Daily notice when the app is opened.
  useEffect(() => {
    if (!ready || state !== 'on') return;
    let last = '';
    try { last = localStorage.getItem(DAY_KEY) || ''; } catch {}
    if (last === todayKey()) return;
    const digest = dueDigest(deudas);
    if (!digest) return;
    navigator.serviceWorker.ready.then(reg => reg.showNotification(digest.title, {
      body: digest.body,
      icon: 'pwa-192.png',
      badge: 'favicon-48.png',
      tag: 'df-due',
      data: { url: './?accion=prestamos' }
    })).then(() => {
      try { localStorage.setItem(DAY_KEY, todayKey()); } catch {}
    }).catch(() => {});
  }, [deudas, ready, state]);

  const registerBackground = useCallback(async () => {
    try {
      const reg: any = await navigator.serviceWorker.ready;
      if (!reg.periodicSync) return false;
      const perm = await (navigator as any).permissions?.query({ name: 'periodic-background-sync' }).catch(() => null);
      if (perm && perm.state !== 'granted') return false;
      await reg.periodicSync.register(SYNC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (state === 'on') void registerBackground().then(setBackground);
  }, [state, registerBackground]);

  const enable = useCallback(async () => {
    if (!supported()) return 'unsupported' as NotifyState;
    const permission = await Notification.requestPermission();
    try { localStorage.setItem(PREF_KEY, permission === 'granted' ? '1' : '0'); } catch {}
    try { localStorage.removeItem(DAY_KEY); } catch {}
    const next = readState();
    setState(next);
    return next;
  }, []);

  const disable = useCallback(async () => {
    try { localStorage.setItem(PREF_KEY, '0'); } catch {}
    setState(readState());
    try {
      const reg: any = await navigator.serviceWorker.ready;
      await reg.periodicSync?.unregister(SYNC_TAG);
    } catch {}
    setBackground(false);
  }, []);

  return { state, background, enable, disable };
}
