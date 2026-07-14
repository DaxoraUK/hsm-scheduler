import { toast as sonnerToast } from "sonner";

const STORAGE_KEY = "daxora:notifications:v1";
const EVENT_NAME = "daxora:notification-change";
const MAX_NOTIFICATIONS = 120;

let notificationContext = {
  workspaceType: "platform",
  workspaceId: "",
  workspaceName: "Daxora",
};

let remoteAdapter = null;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normaliseNotification(input = {}) {
  const createdAt = input.createdAt || new Date().toISOString();
  const severity = ["success", "info", "warning", "error", "action"].includes(input.severity)
    ? input.severity
    : "info";
  return {
    id: input.id || makeId(),
    title: String(input.title || "Daxora update"),
    description: String(input.description || ""),
    severity,
    category: String(input.category || (severity === "error" ? "system" : "activity")),
    createdAt: input.created_at || createdAt,
    readAt: input.read_at || input.readAt || null,
    resolvedAt: input.resolved_at || input.resolvedAt || null,
    dismissedAt: input.dismissed_at || input.dismissedAt || null,
    href: input.href || "",
    actionLabel: input.action_label || input.actionLabel || "",
    workspaceType: input.workspace_type || input.workspaceType || notificationContext.workspaceType,
    workspaceId: input.workspace_id || input.workspaceId || notificationContext.workspaceId,
    workspaceName: input.workspace_name || input.workspaceName || notificationContext.workspaceName,
    leagueId: input.league_id || input.leagueId || "",
    clubId: input.club_id || input.clubId || "",
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}

export function setDaxoraNotificationContext(next = {}) {
  notificationContext = {
    ...notificationContext,
    ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)),
  };
}

export function configureDaxoraNotificationRemoteAdapter(adapter = null) {
  remoteAdapter = adapter && typeof adapter === "object" ? adapter : null;
  return () => { if (remoteAdapter === adapter) remoteAdapter = null; };
}

function callRemote(method, ...args) {
  try {
    const result = remoteAdapter?.[method]?.(...args);
    if (result && typeof result.catch === "function") result.catch(() => {});
    return result;
  } catch {
    return null;
  }
}

export function mergeDaxoraNotifications(items = []) {
  const byId = new Map(readDaxoraNotifications().map((item) => [item.id, item]));
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalised = normaliseNotification(item);
    const existing = byId.get(normalised.id);
    byId.set(normalised.id, existing ? { ...existing, ...normalised } : normalised);
  });
  return writeNotifications([...byId.values()].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))));
}

export function readDaxoraNotifications() {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map(normaliseNotification).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      : [];
  } catch {
    return [];
  }
}

function writeNotifications(items) {
  const next = Array.isArray(items) ? items.slice(0, MAX_NOTIFICATIONS) : [];
  if (canUseStorage()) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { /* Storage can be unavailable in private or restricted browser sessions. */ }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }
  return next;
}

export function subscribeToDaxoraNotifications(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => listener(Array.isArray(event.detail) ? event.detail : readDaxoraNotifications());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

export function publishDaxoraNotification(input = {}) {
  const item = normaliseNotification(input);
  const existing = readDaxoraNotifications();
  const dedupeKey = input.dedupeKey || "";
  const next = dedupeKey
    ? [item, ...existing.filter((row) => row.metadata?.dedupeKey !== dedupeKey)]
    : [item, ...existing];
  if (dedupeKey) item.metadata = { ...item.metadata, dedupeKey };
  writeNotifications(next);
  const remote = callRemote("publish", item);
  if (remote && typeof remote.then === "function") remote.then((saved) => { if (saved) mergeDaxoraNotifications([saved]); }).catch(() => {});
  return item;
}

export function markDaxoraNotificationRead(id, read = true) {
  const readAt = read ? new Date().toISOString() : null;
  const next = writeNotifications(readDaxoraNotifications().map((item) => item.id === id ? { ...item, readAt } : item));
  callRemote("mark", id, read ? "read" : "unread");
  return next;
}

export function markAllDaxoraNotificationsRead() {
  const readAt = new Date().toISOString();
  const next = writeNotifications(readDaxoraNotifications().map((item) => item.readAt ? item : { ...item, readAt }));
  callRemote("markAll", "read");
  return next;
}

export function dismissDaxoraNotification(id) {
  const next = writeNotifications(readDaxoraNotifications().filter((item) => item.id !== id));
  callRemote("mark", id, "dismiss");
  return next;
}

export function clearReadDaxoraNotifications() {
  const next = writeNotifications(readDaxoraNotifications().filter((item) => !item.readAt));
  callRemote("markAll", "dismiss_read");
  return next;
}

export function clearAllDaxoraNotifications() {
  return writeNotifications([]);
}

function persistFromToast(severity, message, options = {}) {
  const shouldPersist = options.persist === true
    || severity === "error"
    || severity === "warning"
    || severity === "action";
  if (!shouldPersist || options.notification === false) return null;
  return publishDaxoraNotification({
    title: typeof message === "string" ? message : options.title || "Daxora update",
    description: options.description || "",
    severity,
    category: options.category,
    href: options.href,
    actionLabel: options.actionLabel,
    dedupeKey: options.dedupeKey,
    metadata: options.metadata,
  });
}

function withDefaults(options = {}) {
  const {
    persist: _persist,
    notification: _notification,
    category: _category,
    href: _href,
    actionLabel: _actionLabel,
    dedupeKey: _dedupeKey,
    metadata: _metadata,
    ...sonnerOptions
  } = options;
  return {
    duration: sonnerOptions.duration ?? 4800,
    ...sonnerOptions,
  };
}

function show(kind, message, options = {}) {
  persistFromToast(kind, message, options);
  const method = kind === "action" ? "info" : kind;
  return sonnerToast[method]?.(message, withDefaults(options)) ?? sonnerToast(message, withDefaults(options));
}

export function toast(message, options = {}) {
  return show("info", message, options);
}

toast.success = (message, options = {}) => show("success", message, options);
toast.info = (message, options = {}) => show("info", message, options);
toast.warning = (message, options = {}) => show("warning", message, options);
toast.error = (message, options = {}) => show("error", message, options);
toast.actionRequired = (message, options = {}) => show("action", message, { ...options, persist: true });
toast.loading = (message, options = {}) => sonnerToast.loading(message, withDefaults({ duration: Infinity, ...options }));
toast.dismiss = (id) => sonnerToast.dismiss(id);
toast.promise = (...args) => sonnerToast.promise(...args);
toast.custom = (...args) => sonnerToast.custom(...args);
