const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const env = require("./config/env");

const authRoutes = require("./routes/authRoutes");
const displayMediaRoutes = require("./routes/displayMediaRoutes");
const backgroundRoutes = require("./routes/backgroundRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const errorHandler = require("./middlewares/errorHandler");
const seedAdmin = require("./seeder/adminSeeder");

const app = express();

const allowedOrigin = env.client.url;

// Middleware
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
    ],
  })
);
app.use(express.json());
app.use(cookieParser());

// Database Connection & Admin Seeder
const initializeApp = async () => {
  try {
    await connectDB();
    await seedAdmin();
  } catch (error) {
    console.error("❌ Error initializing app:", error);
  }
};

initializeApp();

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/display-media", displayMediaRoutes);
app.use("/api/backgrounds", backgroundRoutes);
app.use("/api/categories", categoryRoutes);

// Health Check
app.get("/", (req, res) => {
  console.log("📡 Timeline Server is running...");
  res.status(200).send("OK");
});

// Error Handler
app.use(errorHandler);

module.exports = app;
