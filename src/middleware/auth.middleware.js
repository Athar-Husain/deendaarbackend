// backend/src/middleware/auth.middleware.js

import ApiError from "../utils/ApiError.js";
import { verifyAccessToken } from "../services/token.service.js";
import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";
import Admin from "../models/Admin.model.js";

const MODELS = {
  applicant: Applicant,
  organization: Organization,
  admin: Admin,
};

export const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return next(new ApiError(401, "Authentication required."));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new ApiError(401, "Access token is invalid or expired."));
    }

    const Model = MODELS[decoded.role];
    if (!Model) {
      return next(new ApiError(401, "Invalid token role."));
    }

    const user = await Model.findById(decoded.id);
    if (!user) {
      return next(new ApiError(401, "User no longer exists."));
    }

    if (user.blocked || user.suspended) {
      throw new ApiError(403, "Your account has been blocked or suspended");
    }

    req.user = user;
    req.role = decoded.role;
    req.restricted = Boolean(decoded.restricted);

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Guard: only fully-approved accounts can access.
 */

export const requireFullAccess = (req, _res, next) => {
  if (req.restricted || req.user?.status !== "approved") {
    return next(
      new ApiError(
        403,
        "Upload your documents and wait for admin approval to unlock this feature.",
      ),
    );
  }
  return next();
};
export const requireApproved = (req, _res, next) => {
  if (req.role === "admin") return next();
  
  if (req.restricted || req.user?.status !== "approved") {
    return next(
      new ApiError(
        403,
        "Upload your documents and wait for admin approval to unlock this feature.",
      ),
    );
  }
  return next();
};

/**
 * Guard: role-based.
 */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.role)) {
      return next(new ApiError(403, "Forbidden."));
    }
    return next();
  };
