/**
 * Attribute values the rich-text editor may produce, shared by the client
 * extensions (src/components/rich-editor) and the server's document
 * validation (./schema.ts) so the two never drift apart.
 */

export const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;
export const TEXT_ALIGNS = ["left", "center", "right", "justify"] as const;
export const IMAGE_ALIGNS = ["left", "center", "right", "full"] as const;

/** Article images are only ever served from our own upload route. */
export const ARTICLE_IMAGE_URL_PREFIX = "/api/article-images/";
/** Keys the upload route issues: `<uuid>.webp`. */
export const ARTICLE_IMAGE_KEY = /^[0-9a-f-]{36}\.webp$/;
/** Upper bound for a stored image width/height (px) — matches the upload downscale. */
export const MAX_IMAGE_DIMENSION = 4000;
