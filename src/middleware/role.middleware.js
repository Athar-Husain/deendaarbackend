import ApiError from "../utils/ApiError.js";
import { AUTH } from "../constants/messages.js";

const requireRole =
  (...allowed) =>
  (req, res, next) => {
    if (!req.role || !allowed.includes(req.role)) {
      return next(new ApiError(403, AUTH.FORBIDDEN));
    }

    next();
  };

export { requireRole };
