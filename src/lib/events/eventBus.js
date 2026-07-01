export function createEventBus() {
  const listeners = new Map();

  const on = (eventName, handler) => {
    if (!eventName || typeof handler !== "function") return () => {};
    const handlers = listeners.get(eventName) || new Set();
    handlers.add(handler);
    listeners.set(eventName, handlers);
    return () => off(eventName, handler);
  };

  const off = (eventName, handler) => {
    const handlers = listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) listeners.delete(eventName);
  };

  const emit = (eventName, payload = {}) => {
    const event = {
      name: eventName,
      payload,
      createdAt: new Date().toISOString(),
    };

    (listeners.get(eventName) || []).forEach((handler) => handler(event));
    (listeners.get("*") || []).forEach((handler) => handler(event));
    return event;
  };

  const clear = () => listeners.clear();

  return { on, off, emit, clear };
}

export const appEventBus = createEventBus();
