const DisplayMedia = require("../../models/DisplayMedia");

/**
 * Migration: Delete all media records that are using the legacy category structure.
 */
module.exports = async () => {
  console.log("🏃 Running Migration: 001_delete_legacy_media_records...");

  // Delete records where categoryPath is missing or empty
  const result = await DisplayMedia.deleteMany({
    $or: [
      { categoryPath: { $exists: false } },
      { categoryPath: { $size: 0 } }
    ]
  });

  console.log(`Migration 001 finished. Deleted ${result.deletedCount} legacy records.`);
};
