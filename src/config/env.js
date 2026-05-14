require('dotenv').config();

// Function to validate required environment variables
const validateEnv = (key) => {
  if (!process.env[key]) {
    throw new Error(
      `❌ Environment variable "${key}" is missing. Please define it in your .env.local file.`
    );
  }
  return process.env[key];
};

const getEnv = (key, fallback = "") => process.env[key] || fallback;

// Centralized Environment Configuration
const env = {
  database: {
    url: validateEnv("MONGO_URI"),
  },
  jwt: {
    secret: validateEnv("JWT_SECRET"),
    accessExpiry: validateEnv("JWT_ACCESS_EXPIRY"),
    refreshExpiry: validateEnv("JWT_REFRESH_EXPIRY"),
  },
  client:{
    url:validateEnv("CLIENT_URL")
  },
  server: {
    port: validateEnv("PORT"),
    nodeEnv: validateEnv("NODE_ENV"),
  },
  masterKey: validateEnv("MASTER_KEY"),
  aws: {
    region: validateEnv("AWS_REGION"),
    accessKeyId: validateEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: validateEnv("AWS_SECRET_ACCESS_KEY"),
    s3Bucket: validateEnv("S3_BUCKET"),
    cloudfrontUrl: getEnv("CLOUDFRONT_URL"),
  },
  node_env: process.env.NODE_ENV || "development",
};

module.exports = env;
