require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const getEnv = (key, fallback = "") => process.env[key] || fallback;

const validateEnv = (key, fallback = undefined) => {
  const val = process.env[key];
  if (val !== undefined && val !== "") return val;
  if (!isProd && fallback !== undefined) return fallback;
  throw new Error(
    `❌ Environment variable "${key}" is missing. Please define it in your .env.local file.`
  );
};

// Centralized Environment Configuration
const env = {
  database: {
    url: validateEnv('MONGO_URI', 'mongodb://localhost:27017/mtcit'),
  },
  jwt: {
    secret: validateEnv('JWT_SECRET', 'dev_jwt_secret'),
    accessExpiry: validateEnv('JWT_ACCESS_EXPIRY', '1h'),
    refreshExpiry: validateEnv('JWT_REFRESH_EXPIRY', '7d'),
  },
  client: {
    url: validateEnv('CLIENT_URL', 'http://localhost:3000'),
  },
  server: {
    port: validateEnv('PORT', '4000'),
    nodeEnv: validateEnv('NODE_ENV', 'development'),
  },
  masterKey: validateEnv('MASTER_KEY', 'dev_master_key'),
  aws: {
    region: validateEnv('AWS_REGION', 'us-east-1'),
    accessKeyId: validateEnv('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: validateEnv('AWS_SECRET_ACCESS_KEY', ''),
    s3Bucket: validateEnv('S3_BUCKET', ''),
    cloudfrontUrl: getEnv('CLOUDFRONT_URL'),
  },
};

module.exports = env;
