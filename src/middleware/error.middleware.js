import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { nodeEnv } from "../config/env.js";

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
 
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== false;

  if (!isOperational || statusCode >= 500) {
    logger.error(
      `${req.method} ${req.originalUrl} - ${err.message}\n${err.stack || ""}`,
    );
  }

  const response = {
    success: false,
    message: isOperational ? err.message : "Internal server error",
    errors: err.errors || [],
  };

  if (nodeEnv === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).status(statusCode).json(response);
};

export { notFound, errorHandler };
