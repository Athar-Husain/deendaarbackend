import { verifyAccessToken } from "../services/token.service.js";
import logger from "../utils/logger.js";

export const initChatSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || "").replace("Bearer ", "");
      if (!token) return next(new Error("Authentication required"));
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      socket.role = decoded.role;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.userId} (${socket.role})`);

    socket.on("chat:join", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
    });

    socket.on("chat:leave", (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId);
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.userId}`);
    });
  });
};
