/* Preztame · due-date reminders inside the service worker.
 * The app saves a small summary of pending loans in Cache Storage; on a
 * periodic background sync (Android, installed app) we show at most one
 * notification per day. Tapping it opens the app on the loans list. */
const DF_META_CACHE = 'df-meta';
const DUE_URL = '/__df/due.json';
const NOTIFIED_URL = '/__df/notified.json';

async function readJson(url) {
  const cache = await caches.open(DF_META_CACHE);
  const res = await cache.match(url);
  return res ? res.json() : null;
}

async function writeJson(url, value) {
  const cache = await caches.open(DF_META_CACHE);
  await cache.put(url, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}

function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function checkDue() {
  const data = await readJson(DUE_URL);
  if (!data || !data.enabled || !Array.isArray(data.items)) return;
  const today = new Date();
  const notified = await readJson(NOTIFIED_URL);
  if (notified && notified.day === dayKey(today)) return;

  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let overdue = 0, soon = 0, total = 0;
  const names = [];
  data.items.forEach(function (it) {
    const m = /^(\d{4})-(\d{2})$/.exec(it.mesPago || '');
    if (!m) return;
    const due = new Date(+m[1], +m[2], 0).getTime();
    const days = Math.round((due - t0) / 86400000);
    if (days < 0) overdue++;
    else if (days <= 3) soon++;
    else return;
    total += it.saldo;
    if (names.indexOf(it.contacto) < 0) names.push(it.contacto);
  });
  if (!overdue && !soon) return;

  const parts = [];
  if (overdue) parts.push(overdue + ' cobro' + (overdue === 1 ? '' : 's') + ' vencido' + (overdue === 1 ? '' : 's'));
  if (soon) parts.push(soon + ' vence' + (soon === 1 ? '' : 'n') + ' pronto');
  await self.registration.showNotification('Preztame: ' + parts.join(' · '), {
    body: 'Por cobrar $' + Math.round(total) + ' a ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ' y ' + (names.length - 3) + ' más' : '') + '.',
    icon: 'pwa-192.png',
    badge: 'favicon-48.png',
    tag: 'df-due',
    data: { url: './?accion=prestamos' }
  });
  await writeJson(NOTIFIED_URL, { day: dayKey(today) });
}

self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'df-due-check') event.waitUntil(checkDue());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const client of list) {
      if ('focus' in client) return client.navigate(target).then(function (c) { return (c || client).focus(); });
    }
    return self.clients.openWindow(target);
  }));
});
