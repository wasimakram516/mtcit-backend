const mongoose = require("mongoose");

/**
 * Drop the stale unique slug_1 index from displaymedias.
 * Multiple docs with slug=null violate the unique constraint — the field
 * is no longer part of the schema so the index should not exist.
 */
module.exports = async function () {
  try {
    const collection = mongoose.connection.collection("displaymedias");
    const indexes = await collection.indexes();
    const hasSlugIndex = indexes.some((idx) => idx.name === "slug_1");
    if (hasSlugIndex) {
      await collection.dropIndex("slug_1");
      console.log("✅ Dropped stale slug_1 index from displaymedias.");
    } else {
      console.log("ℹ️  slug_1 index not found — nothing to drop.");
    }
  } catch (err) {
    console.warn("⚠️  Could not drop slug_1 index:", err.message);
  }
};
