const DisplayMedia = require("../models/DisplayMedia");

const socketHandler = (io) => {
  io.on("connection", async (socket) => {
    console.log(`🔵 New client attempted to connect: ${socket.id}`);

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    // Helper: Fetch all unique categories and subcategories
    const getCategoryOptions = async () => {
        const categories = await DisplayMedia.aggregate([
          {
            $group: {
              _id: "$category",
              subcategories: { $addToSet: "$subcategory" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              subcategories: 1,
            },
          },
        ]);

        const categoryOptions = {};
        categories.forEach((cat) => {
          const filteredSubs = cat.subcategories.filter(Boolean);
          categoryOptions[cat.category] = filteredSubs;
        });

        return categoryOptions;
      };

    // Build category tree from Category collection if available
    const getCategoryTree = async () => {
      try {
        const Category = require("../models/Category");
        const count = await Category.countDocuments();
        if (!count) return null;

        const all = await Category.find().lean().sort({ depth: 1, "name.en": 1 });

        const map = {};
        all.forEach((c) => (map[c._id] = { ...c, children: [] }));
        const roots = [];
        all.forEach((c) => {
          if (c.parent) {
            const parent = map[c.parent];
            if (parent) parent.children.push(map[c._id]);
          } else {
            roots.push(map[c._id]);
          }
        });

        return roots;
      } catch (err) {
        return null;
      }
    };

    // ✅ Emit category options immediately on connection
    try {
      const categoryOptions = await getCategoryOptions();
      socket.emit("categoryOptions", categoryOptions);
      const categoryTree = await getCategoryTree();
      if (categoryTree) socket.emit("categoryTree", categoryTree);
    } catch (error) {
      console.error("❌ Failed to send category options on init:", error);
    }

    // ✅ Add new event to let client explicitly ask for categoryOptions
    socket.on("getCategoryOptions", async () => {
      try {
        const categoryOptions = await getCategoryOptions();
        socket.emit("categoryOptions", categoryOptions);
        const categoryTree = await getCategoryTree();
        if (categoryTree) socket.emit("categoryTree", categoryTree);
      } catch (error) {
        console.error("❌ Failed to emit category options:", error);
      }
    });

    // 🔁 Send all display media to all clients
    const sendInitialMedia = async () => {
      try {
        const media = await DisplayMedia.find();
        io.emit("mediaUpdate", media);
      } catch (error) {
        console.error("❌ Failed to send media on init:", error);
      }
    };

    await sendInitialMedia();

    socket.on("register", async (role) => {
      socket.role = role;
      console.log(`👤 Client ${socket.id} registered as ${role}`);

      try {
        const media = await DisplayMedia.find();
        socket.emit("mediaUpdate", media);
      } catch (error) {
        console.error("❌ Failed to emit media on register:", error);
      }
    });

    // ✅ Broadcast language change to all clients
    socket.on("changeLanguage", (language) => {
      console.log(`🌐 Language changed to: ${language}`);
      io.emit("languageChanged", language);
    });

    // ✅ When controller selects a category/subcategory
    // Accept either legacy {category, subcategory} or {categoryPath: [ids]}
    socket.on("selectCategory", async ({ category, subcategory, categoryPath, language }) => {
      console.log(`📂 Category selection received | Lang: ${language}`);
      console.log(`📋 categoryPath type check:`, Array.isArray(categoryPath), categoryPath);

      try {
        const categoryOptions = await getCategoryOptions();
        const hasSubcategories = category ? (categoryOptions[category]?.length > 0) : false;
        const shouldShowLoading = hasSubcategories ? !!subcategory : true;

        if (shouldShowLoading) {
          console.log("🚀 Emitting 'categorySelected' loading event");
          io.emit("categorySelected");
        }

        setTimeout(
          async () => {
            try {
              let media = null;

              if (Array.isArray(categoryPath) && categoryPath.length) {
                const leafId = categoryPath[categoryPath.length - 1];
                console.log(`🔍 Looking for media with categoryRef: ${leafId} (type: ${typeof leafId})`);
                
                // Convert string ID to ObjectId
                const mongoose = require("mongoose");
                const leafObjectId = new mongoose.Types.ObjectId(leafId);
                
                // First try: find by categoryRef (most specific)
                media = await DisplayMedia.findOne({ categoryRef: leafObjectId });
                console.log(`First try (categoryRef with ObjectId): ${media ? "FOUND" : "NOT FOUND"}`);
                
                // Second try: find by exact categoryPath match (convert all strings to ObjectIds)
                if (!media) {
                  console.log(`🔍 Trying categoryPath exact match...`);
                  const categoryPathObjectIds = categoryPath.map(id => new mongoose.Types.ObjectId(id));
                  media = await DisplayMedia.findOne({ 
                    categoryPath: { $all: categoryPathObjectIds, $size: categoryPath.length } 
                  });
                  console.log(`Second try (categoryPath with ObjectIds): ${media ? "FOUND" : "NOT FOUND"}`);
                }
                
                // Log what we're emitting
                if (media) {
                  console.log(`✅ Found media ID: ${media._id}`);
                  console.log(`📊 Media structure - en: ${!!media.media?.en}, ar: ${!!media.media?.ar}`);
                  console.log(`📝 Category info - category: ${media.category}, subcategory: ${media.subcategory}, categoryRef: ${media.categoryRef}`);
                }
              } else if (category) {
                console.log(`🔍 Looking for media with category: ${category}, subcategory: ${subcategory}`);
                media = await DisplayMedia.findOne({ category, subcategory });
                console.log(`${media ? "FOUND" : "NOT FOUND"}`);
              }

              if (media) {
                const response = {
                  _id: media._id,
                  category: media.category,
                  subcategory: media.subcategory,
                  categoryPath: media.categoryPath,
                  media: media.media, // Send BOTH en and ar
                  layers: media.layers || [],
                  pinpoint: media.pinpoint,
                };
                console.log(`📤 Emitting displayMedia response`);
                io.emit("displayMedia", response);
              } else {
                console.log("⚠️ No media found for this category - emitting null");
                io.emit("displayMedia", null);
              }
            } catch (err) {
              console.error("❌ Error fetching media:", err);
              io.emit("displayMedia", null);
            }
          },
          shouldShowLoading ? 1000 : 0
        );
      } catch (err) {
        console.error("❌ Error fetching category options:", err);
        io.emit("displayMedia", null);
      }
    });

    // Controller triggers Carbon Mode
    socket.on("toggleCarbonMode", ({ active, value }) => {
      console.log(`🌍 Carbon Mode: ${active ? "ON" : "OFF"} | Value: ${value}`);
      io.emit("carbonMode", { active, value });
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Client disconnected: ${socket.id} - Reason: ${reason}`);
    });
  });
};

module.exports = socketHandler;
