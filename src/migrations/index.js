const fs = require("fs");
const path = require("path");
const Migration = require("../models/Migration");

/**
 * Migration Runner
 * Scans the 'scripts' directory and executes any migrations that haven't been run yet.
 */
const runMigrations = async () => {
  console.log("⚙️ Starting Database Migrations...");

  const scriptsDir = path.join(__dirname, "scripts");
  if (!fs.existsSync(scriptsDir)) {
    console.log("📂 No migrations directory found. Skipping.");
    return;
  }

  const files = fs.readdirSync(scriptsDir).sort();
  
  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    const migrationName = file.replace(".js", "");
    
    // Check if migration already executed
    const existing = await Migration.findOne({ name: migrationName });
    if (existing) {
      // console.log(`⏭️ Migration ${migrationName} already executed. Skipping.`);
      continue;
    }

    try {
      const migrationScript = require(path.join(scriptsDir, file));
      if (typeof migrationScript === "function") {
        await migrationScript();
        
        // Mark as executed
        await Migration.create({ name: migrationName });
        console.log(`✅ Migration ${migrationName} executed successfully.`);
      }
    } catch (err) {
      console.error(`❌ Migration ${migrationName} failed:`, err.message);
      // We stop here to prevent data corruption if a migration fails
      throw err;
    }
  }

  console.log("🏁 All migrations checked/executed.");
};

module.exports = runMigrations;
