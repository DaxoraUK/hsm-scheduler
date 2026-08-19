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

function defineTestGlobal(target, name, value) {
  if (!target) return;
  try {
    Object.defineProperty(target, name, {
      value,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  } catch {
    try {
      target[name] = value;
    } catch {
      // A locked host global is not expected in Vitest, but the setup remains safe.
    }
  }
}

// Node 22 can expose an experimental localStorage getter that resolves to
// undefined unless --localstorage-file is supplied. Tests need deterministic,
// isolated browser storage instead of that host implementation.
const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const testWindow = globalThis.window && typeof globalThis.window === "object"
  ? globalThis.window
  : globalThis;

defineTestGlobal(globalThis, "window", testWindow);
defineTestGlobal(testWindow, "localStorage", localStorage);
defineTestGlobal(testWindow, "sessionStorage", sessionStorage);
defineTestGlobal(globalThis, "localStorage", localStorage);
defineTestGlobal(globalThis, "sessionStorage", sessionStorage);

defineTestGlobal(testWindow, "scrollTo", () => {});
