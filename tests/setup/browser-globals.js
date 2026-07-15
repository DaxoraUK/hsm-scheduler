class MemoryStorage {
  #store = new Map();

  get length() {
    return this.#store.size;
  }

  clear() {
    this.#store.clear();
  }

  getItem(key) {
    const value = this.#store.get(String(key));
    return value === undefined ? null : value;
  }

  key(index) {
    return Array.from(this.#store.keys())[index] ?? null;
  }

  removeItem(key) {
    this.#store.delete(String(key));
  }

  setItem(key, value) {
    this.#store.set(String(key), String(value));
  }
}

function hasUsableStorage(storage) {
  return Boolean(
    storage
      && typeof storage.clear === "function"
      && typeof storage.getItem === "function"
      && typeof storage.setItem === "function"
      && typeof storage.removeItem === "function",
  );
}

function readStorage(target) {
  if (!target) return null;
  try {
    return target.localStorage;
  } catch {
    return null;
  }
}

const fallbackStorage = new MemoryStorage();
const windowStorage = readStorage(globalThis.window);

if (globalThis.window && !hasUsableStorage(windowStorage)) {
  Object.defineProperty(globalThis.window, "localStorage", {
    value: fallbackStorage,
    configurable: true,
  });
}

const globalStorage = readStorage(globalThis);

if (!hasUsableStorage(globalStorage)) {
  Object.defineProperty(globalThis, "localStorage", {
    value: globalThis.window?.localStorage || fallbackStorage,
    configurable: true,
  });
}
