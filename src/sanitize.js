/**
 * Central HTML sanitization utilities using DOMPurify.
 *
 * Two sanitizers are exported:
 *
 *  sanitizeHtml(html)
 *    For user-supplied HTML content such as footnote text, raw-HTML node
 *    rendering, and any place where arbitrary HTML is injected into the DOM.
 *    Strips script tags, event handlers (onclick, onerror, …) and
 *    javascript: / data: URLs while preserving all legitimate formatting.
 *
 *  sanitizeStyleHtml(html)
 *    For CSS <style> blocks that have been extracted from imported documents
 *    and are re-injected into a dedicated style container element.
 *    DOMPurify strips <style> tags by default; this variant whitelists them
 *    because CSS cannot execute JavaScript in modern browsers. Scripts and
 *    event handlers are still stripped.
 *    
 *    That's a lot of documentation, but just know that this cleans all the things!
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize general HTML content.
 * Safe for use with dangerouslySetInnerHTML and innerHTML on content elements.
 *
 * @param {string} html - Raw HTML string to sanitize.
 * @returns {string} Sanitized HTML string.
 */
export function sanitizeHtml(html) {
  if (!html) return html;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

/**
 * Sanitize HTML that contains <style> blocks.
 * Use only for injecting CSS into a dedicated <style> container — never for
 * rendering visible content.
 *
 * @param {string} html - Raw HTML string (expected to contain <style> tags).
 * @returns {string} Sanitized HTML string with <style> tags preserved.
 */
export function sanitizeStyleHtml(html) {
  if (!html) return html;
  return DOMPurify.sanitize(html, {
    FORCE_BODY: true,
    ADD_TAGS: ['style'],
    ADD_ATTR: ['type', 'media', 'scoped'],
  });
}
