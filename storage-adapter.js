(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StoreStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createJsonStorage(storageProvider) {
    const getStorage = typeof storageProvider === 'function'
      ? storageProvider
      : () => storageProvider;

    return {
      read(key, fallback) {
        try {
          const raw = getStorage()?.getItem(key);
          return raw === null || raw === undefined ? fallback : JSON.parse(raw) ?? fallback;
        } catch {
          return fallback;
        }
      },

      write(key, value) {
        try {
          const storage = getStorage();
          if (!storage) return false;
          storage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  return { createJsonStorage };
});
