const DEFAULT_URL = "/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json?.() || {}; }
  catch { payload = {}; }
  const title = payload.title || "Daxora Ground Control";
  const options = {
    body: payload.body || "You have a new Daxora update. Open Ground Control to review it.",
    icon: "/daxora-icon-192.png",
    badge: "/daxora-icon-192.png",
    tag: payload.tag || "daxora-update",
    renotify: Boolean(payload.renotify),
    data: { url: payload.url || DEFAULT_URL },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || DEFAULT_URL, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
