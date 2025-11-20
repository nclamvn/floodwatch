/**
 * Decode HTML entities efficiently
 * Uses a cached textarea element to avoid creating new DOM nodes on every call
 */

let cachedTextArea: HTMLTextAreaElement | null = null

/**
 * Decode HTML entities in a string
 * More efficient than creating a new textarea on every call
 *
 * @param html - String with HTML entities (e.g., "&amp;", "&lt;")
 * @returns Decoded string
 */
export function decodeHTML(html: string): string {
  if (!html) return ''

  // Create textarea only once and reuse it
  if (typeof window !== 'undefined' && !cachedTextArea) {
    cachedTextArea = document.createElement('textarea')
  }

  if (cachedTextArea) {
    cachedTextArea.innerHTML = html
    return cachedTextArea.value
  }

  // Fallback for SSR or if textarea creation fails
  return html
}

/**
 * Decode HTML entities for multiple strings at once
 * @param strings - Array of strings to decode
 * @returns Array of decoded strings
 */
export function decodeHTMLBatch(strings: string[]): string[] {
  return strings.map(decodeHTML)
}
