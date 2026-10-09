// backend/server.js
import dns from "dns";
import http from "http";
import { Server } from "socket.io";

import { createApp } from "./src/app.js";
import { connectDatabase } from "./src/config/database1.js";
import { port, corsOrigins, nodeEnv } from "./src/config/env.js";
import { initChatSocket } from "./src/sockets/chat.socket.js";
import logger from "./src/utils/logger.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const bootstrap = async () => {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: corsOrigins.length ? corsOrigins : "*",
      credentials: true,
    },
    path: "/socket.io",
  });

  initChatSocket(io);
  app.set("io", io);

  server.listen(port, () => {
    logger.info(`DEENDAAR API running on port ${port} (${nodeEnv})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down...`);
    io.close();

    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });

  process.on("uncaughtException", (err) => {
    logger.error(`Uncaught Exception: ${err.message}\n${err.stack}`);
    shutdown("uncaughtException");
  });
};

bootstrap().catch((err) => {
  logger.error(`Bootstrap failed: ${err.message}`);
  process.exit(1);
});
