import { Auth, DB } from "../supabase.js";

function decodeUrlBase64(value = "") {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = String(value).replaceAll("-", "+").replaceAll("_", "/") + padding;
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function getDaxoraPushCapability() {
  const supported = typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
  const vapidPublicKey = String(import.meta.env?.VITE_DAXORA_VAPID_PUBLIC_KEY || "").trim();
  return {
    supported,
    configured: Boolean(vapidPublicKey),
    permission: supported ? Notification.permission : "unsupported",
    vapidPublicKey,
  };
}

export async function ensureDaxoraServiceWorker() {
  const capability = getDaxoraPushCapability();
  if (!capability.supported) throw Object.assign(new Error("This browser does not support installed-app notifications."), { code: "PUSH_UNSUPPORTED" });
  await navigator.serviceWorker.register("/daxora-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function readDaxoraBrowserPushSubscription() {
  const registration = await ensureDaxoraServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function enableDaxoraBrowserPush() {
  const capability = getDaxoraPushCapability();
  if (!capability.configured) throw Object.assign(new Error("The Daxora push public key has not been configured on this deployment."), { code: "PUSH_NOT_CONFIGURED" });
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw Object.assign(new Error("Browser notification permission was not granted."), { code: "PUSH_PERMISSION_DENIED" });
  const registration = await ensureDaxoraServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeUrlBase64(capability.vapidPublicKey),
  });
  await DB.registerDaxoraPushSubscription(subscription);
  return subscription;
}

export async function disableDaxoraBrowserPush() {
  const subscription = await readDaxoraBrowserPushSubscription();
  if (!subscription) return false;
  await DB.removeDaxoraPushSubscription(subscription.endpoint).catch(() => null);
  await subscription.unsubscribe();
  return true;
}

export async function sendDaxoraTestPush() {
  const session = await Auth.getValidSession();
  if (!session?.access_token) throw new Error("Sign in again to send a test notification.");
  const response = await fetch("/api/notifications/push-test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ requestedAt: new Date().toISOString() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload?.error || "The test push could not be sent."), { code: payload?.code || "PUSH_TEST_FAILED" });
  return payload;
}
