(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.StoreState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));

  function normalizeProfile(value, fallback) {
    const source = isObject(value) ? value : {};
    return Object.fromEntries(
      Object.entries(fallback).map(([key, defaultValue]) => [
        key,
        typeof source[key] === 'string' ? source[key] : defaultValue,
      ]),
    );
  }

  function normalizeSavedStoreState(value, defaults, seedProducts) {
    const source = isObject(value) ? value : {};
    const storedProducts = Array.isArray(source.products) && source.products.length
      ? source.products.filter(product => isObject(product) && Number.isFinite(Number(product.id)))
      : [];
    const products = storedProducts.length ? storedProducts : clone(seedProducts);
    const productIds = new Set(products.map(product => Number(product.id)));

    const cart = Array.isArray(source.cart)
      ? source.cart
          .filter(item => isObject(item) && productIds.has(Number(item.id)) && Number(item.qty) > 0)
          .map(item => ({
            ...item,
            id: Number(item.id),
            qty: Math.max(1, Math.floor(Number(item.qty))),
            storage: typeof item.storage === 'string' ? item.storage : '',
            color: typeof item.color === 'string' ? item.color : '',
          }))
      : [];

    const wishlist = Array.isArray(source.wishlist)
      ? [...new Set(source.wishlist.map(Number).filter(id => productIds.has(id)))]
      : [];
    const points = Number(source.points);

    return {
      ...defaults,
      ...source,
      cart,
      wishlist,
      orders: Array.isArray(source.orders) ? source.orders : [],
      products,
      points: Number.isFinite(points) && points >= 0 ? points : defaults.points,
      profile: normalizeProfile(source.profile, defaults.profile),
      theme: ['light', 'dark'].includes(source.theme) ? source.theme : defaults.theme,
      language: ['English', 'Somali', 'Arabic'].includes(source.language) ? source.language : defaults.language,
      notifications: typeof source.notifications === 'boolean' ? source.notifications : defaults.notifications,
      biometric: typeof source.biometric === 'boolean' ? source.biometric : defaults.biometric,
      promo: typeof source.promo === 'string' ? source.promo : defaults.promo,
      usePoints: typeof source.usePoints === 'boolean' ? source.usePoints : defaults.usePoints,
    };
  }

  return { normalizeSavedStoreState };
});
