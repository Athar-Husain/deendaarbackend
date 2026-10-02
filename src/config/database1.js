import mongoose from "mongoose";
import config from "./env.js";
import logger from "../utils/logger.js";

const { mongoUri } = config;

async function connectDatabase() {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(mongoUri, {
      autoIndex: process.env.NODE_ENV !== "production",
      serverSelectionTimeoutMS: 10000,
    });

    logger.info("MongoDB connected successfully");
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (err) => {
    logger.error(`MongoDB runtime error: ${err.message}`);
  });
}

export { connectDatabase };
