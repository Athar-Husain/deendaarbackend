// backend/src/config/env.js

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "..", "..", ".env"),
});

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const config = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number.parseInt(process.env.PORT, 10) || 5000,

  /**
   * Base URL used to build absolute URLs for mock uploads.
   * In production, set this to your real domain.
   */
  appBaseUrl:
    process.env.APP_BASE_URL ||
    `http://localhost:${Number.parseInt(process.env.PORT, 10) || 5000}`,

  mongoUri: process.env.MONGODB_URI,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  },

  corsOrigins: (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || "DEENDAAR <no-reply@deendaar.com>",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || "job-portal",
  },

  /**
   * Upload provider:
   *   "mock"       → saves files to backend/uploads/, served by express.static
   *   "cloudinary" → streams to Cloudinary
   */
  uploadProvider:
    String(process.env.UPLOAD_PROVIDER || "mock").toLowerCase() === "cloudinary"
      ? "cloudinary"
      : "mock",

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined,
  },

  adminSeed: {
    email: process.env.ADMIN_EMAIL || "admin@deendaar.com",
    password: process.env.ADMIN_PASSWORD || "Admin@12345",
  },

  /**
   * 🎭 Demo mode.
   * When true:
   *   - Mobile shows a "Skip (Demo Mode)" button on upload screens.
   *   - Optionally, authState can treat everyone as approved.
   *
   * Turn OFF for production by setting DEMO_MODE=false in .env
   */
  demoMode: String(process.env.DEMO_MODE || "false").toLowerCase() === "true",
};

/* ------------------------------------------------------------------ */
/* NAMED EXPORTS                                                      */
/* ------------------------------------------------------------------ */

export const {
  nodeEnv,
  port,
  appBaseUrl,
  mongoUri,
  jwt,
  corsOrigins,
  smtp,
  cloudinary,
  uploadProvider,
  firebase,
  adminSeed,
  demoMode,
} = config;

/* ------------------------------------------------------------------ */
/* DEFAULT EXPORT (backwards compatible)                              */
/* ------------------------------------------------------------------ */

export default config;
