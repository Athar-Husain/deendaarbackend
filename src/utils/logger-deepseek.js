const winston = require("winston");
const { nodeEnv } = require("../config/env");

const logger = winston.createLogger({
  level: nodeEnv === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
