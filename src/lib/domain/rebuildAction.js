export function createRebuildAction(rebuild = () => undefined) {
  let running = false;

  return (...args) => {
    if (running) return Promise.resolve({ skipped: true });
    running = true;
    return Promise.resolve()
      .then(() => rebuild(...args))
      .finally(() => { running = false; });
  };
}
