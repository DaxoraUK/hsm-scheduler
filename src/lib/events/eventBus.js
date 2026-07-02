const WILDCARD_EVENT = "*";
const DEFAULT_HISTORY_LIMIT = 100;

function normaliseEventName(eventName) {
  return typeof eventName === "string" ? eventName.trim() : "";
}

function createEventRecord(eventName, payload, meta = {}) {
  return Object.freeze({
    id:
      meta.id ||
      `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    name: eventName,
    payload: payload ?? {},
    source: meta.source || "platform",
    createdAt: meta.createdAt || new Date().toISOString(),
    meta: Object.freeze({ ...meta, id: undefined, source: undefined, createdAt: undefined }),
  });
}

function safeCall(handler, event, onError) {
  try {
    handler(event);
  } catch (error) {
    if (typeof onError === "function") {
      onError(error, event);
      return;
    }

    // Keep the bus resilient. One broken subscriber should not stop platform flow.
    console.error(`[EventBus] handler failed for ${event.name}`, error);
  }
}

export function createEventBus(options = {}) {
  const listeners = new Map();
  const history = [];
  const historyLimit = Number.isFinite(options.historyLimit)
    ? Math.max(0, options.historyLimit)
    : DEFAULT_HISTORY_LIMIT;
  const onError = options.onError;

  const getHandlers = (eventName) => listeners.get(eventName) || new Set();

  const on = (eventName, handler) => {
    const name = normaliseEventName(eventName);
    if (!name || typeof handler !== "function") return () => {};

    const handlers = getHandlers(name);
    handlers.add(handler);
    listeners.set(name, handlers);

    return () => off(name, handler);
  };

  const once = (eventName, handler) => {
    if (typeof handler !== "function") return () => {};

    const unsubscribe = on(eventName, (event) => {
      unsubscribe();
      handler(event);
    });

    return unsubscribe;
  };

  const off = (eventName, handler) => {
    const name = normaliseEventName(eventName);
    const handlers = listeners.get(name);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size === 0) listeners.delete(name);
  };

  const emit = (eventName, payload = {}, meta = {}) => {
    const name = normaliseEventName(eventName);
    if (!name) return null;

    const event = createEventRecord(name, payload, meta);

    if (historyLimit > 0) {
      history.push(event);
      if (history.length > historyLimit) history.shift();
    }

    [...getHandlers(name)].forEach((handler) => safeCall(handler, event, onError));
    [...getHandlers(WILDCARD_EVENT)].forEach((handler) => safeCall(handler, event, onError));

    return event;
  };

  const hasListeners = (eventName) => getHandlers(normaliseEventName(eventName)).size > 0;

  const listenerCount = (eventName = WILDCARD_EVENT) => {
    if (eventName === WILDCARD_EVENT) {
      return [...listeners.values()].reduce((total, handlers) => total + handlers.size, 0);
    }
    return getHandlers(normaliseEventName(eventName)).size;
  };

  const getHistory = (eventName) => {
    const name = normaliseEventName(eventName);
    const records = name ? history.filter((event) => event.name === name) : history;
    return [...records];
  };

  const clear = () => listeners.clear();

  const clearHistory = () => {
    history.length = 0;
  };

  return Object.freeze({
    on,
    once,
    off,
    emit,
    clear,
    clearHistory,
    getHistory,
    hasListeners,
    listenerCount,
  });
}

export const appEventBus = createEventBus();

export function emitDomainEvent(eventName, payload = {}, meta = {}) {
  return appEventBus.emit(eventName, payload, meta);
}

export function subscribeToDomainEvent(eventName, handler) {
  return appEventBus.on(eventName, handler);
}

export function subscribeToAllDomainEvents(handler) {
  return appEventBus.on(WILDCARD_EVENT, handler);
}
