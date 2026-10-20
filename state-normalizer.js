(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.StoreState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const finiteNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const text = value => typeof value === 'string' ? value.trim() : '';

  function normalizeProduct(value) {
    if (!isObject(value)) return null;

    const id = Number(value.id);
    const name = text(value.name);
    const brand = text(value.brand);
    const storage = Array.isArray(value.storage)
      ? [...new Set(value.storage.map(text).filter(Boolean))]
      : [];
    const colors = Array.isArray(value.colors)
      ? value.colors
          .filter(color => Array.isArray(color) && color.length >= 2)
          .map(([nameValue, cssValue]) => [text(nameValue), text(cssValue)])
          .filter(([nameValue, cssValue]) => nameValue && /^#[\da-f]{3,8}$/i.test(cssValue))
      : [];
    const price = finiteNumber(value.price, NaN);

    if (!Number.isInteger(id) || id <= 0 || !name || !brand || !storage.length
      || !colors.length || !Number.isFinite(price) || price <= 0) return null;

    const oldPrice = Math.max(price, finiteNumber(value.oldPrice, price));
    return {
      ...value,
      id,
      name,
      brand,
      image: text(value.image),
      price,
      oldPrice,
      discount: Math.min(100, Math.max(0, Math.round(finiteNumber(value.discount, 0)))),
      rating: Math.min(5, Math.max(0, finiteNumber(value.rating, 0))),
      reviews: Math.max(0, Math.floor(finiteNumber(value.reviews, 0))),
      storage,
      colors,
      stock: typeof value.stock === 'boolean' ? value.stock : true,
      description: text(value.description),
      points: Math.max(0, Math.floor(finiteNumber(value.points, 0))),
    };
  }

  function normalizeProducts(value, seedProducts) {
    if (!Array.isArray(value) || !value.length) return clone(seedProducts);

    const seen = new Set();
    const products = value.map(normalizeProduct).filter(product => {
      if (!product || seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
    return products.length ? products : clone(seedProducts);
  }

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
    const products = normalizeProducts(source.products, seedProducts);
    const productIds = new Set(products.map(product => Number(product.id)));

    const cart = Array.isArray(source.cart)
      ? source.cart
          .filter(item => isObject(item) && productIds.has(Number(item.id))
            && Number.isFinite(Number(item.qty)) && Number(item.qty) > 0)
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

  return { normalizeProduct, normalizeProducts, normalizeSavedStoreState };
});
