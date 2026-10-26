(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StoreRender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function inlineString(value = '') {
    return escapeHtml(JSON.stringify(String(value)));
  }

  function safeImageUrl(value = '') {
    const candidate = String(value).trim();
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate, 'https://store.invalid/');
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return escapeHtml(candidate);
    } catch {
      return '';
    }
  }

  return { escapeHtml, inlineString, safeImageUrl };
});
