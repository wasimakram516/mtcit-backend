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

    // ✅ Emit category options immediately on connection
    try {
      const categoryOptions = await getCategoryOptions();
      socket.emit("categoryOptions", categoryOptions);
    } catch (error) {
      console.error("❌ Failed to send category options on init:", error);
    }

    // ✅ Add new event to let client explicitly ask for categoryOptions
    socket.on("getCategoryOptions", async () => {
      try {
        const categoryOptions = await getCategoryOptions();
        socket.emit("categoryOptions", categoryOptions);
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
    socket.on("selectCategory", async ({ category, subcategory, language }) => {
      console.log(
        `📂 Category selected: ${category} > ${subcategory} | Lang: ${language}`
      );

      try {
        const categoryOptions = await getCategoryOptions();
        const hasSubcategories = categoryOptions[category]?.length > 0;
        const shouldShowLoading = hasSubcategories ? !!subcategory : true;

        if (shouldShowLoading) {
          console.log("🚀 Emitting 'categorySelected' loading event");
          io.emit("categorySelected");
        }

        setTimeout(
          async () => {
            try {
              const media = await DisplayMedia.findOne({
                category,
                subcategory,
              });
              if (media) {
                io.emit("displayMedia", {
                  _id: media._id,
                  category: media.category,
                  subcategory: media.subcategory,
                  media: media.media[language || "en"],
                  pinpoint: media.pinpoint,
                });
              } else {
                console.log("⚠️ No media found for this category");
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
