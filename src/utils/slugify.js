/**
 * URL-safe slug: lowercase, spaces to hyphens, strip invalid chars.
 */
function normalizeSlug(input) {
  if (input === undefined || input === null) return "";
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = { normalizeSlug };
