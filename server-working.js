import "dotenv/config";
import http from "http";
import mongoose from "mongoose";

import app from "./src/app.js";
import connectDB from "./src/config/database.js";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  server.close(async (err) => {
    if (err) {
      console.error("Error closing HTTP server:", err);
    } else {
      console.log("HTTP server closed");
    }

    try {
      await mongoose.connection.close(false);
      console.log("MongoDB disconnected");
    } catch (err) {
      console.error("Error disconnecting MongoDB:", err);
    }

    process.exit(0);
  });
};

// Process handlers
process.on("unhandledRejection", async (err) => {
  console.error("Unhandled Rejection:", err);

  try {
    await mongoose.connection.close(false);
  } catch (closeErr) {
    console.error("Error disconnecting MongoDB:", closeErr);
  }

  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception:", err);

  try {
    await mongoose.connection.close(false);
  } catch (closeErr) {
    console.error("Error disconnecting MongoDB:", closeErr);
  }

  process.exit(1);
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
