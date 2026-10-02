import ApiError from "../utils/ApiError.js";
import { verifyAccessToken } from "../services/token.service.js";
import { AUTH } from "../constants/messages.js";
import Applicant from "../models/Applicant.model.js";
import Organization from "../models/Organization.model.js";
import Admin from "../models/Admin.model.js";

const MODEL_MAP = {
  applicant: Applicant,
  organization: Organization,
  admin: Admin,
};

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new ApiError(401, AUTH.UNAUTHORIZED);
    }

    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      throw new ApiError(401, AUTH.TOKEN_EXPIRED);
    }

    const Model = MODEL_MAP[decoded.role];

    if (!Model) {
      throw new ApiError(401, AUTH.UNAUTHORIZED);
    }

    const user = await Model.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, AUTH.UNAUTHORIZED);
    }

    if (user.blocked || user.suspended) {
      throw new ApiError(403, "Your account has been blocked or suspended");
    }

    req.user = user;
    req.role = decoded.role;

    next();
  } catch (err) {
    next(err);
  }
};

const requireApproved = (req, res, next) => {
  if (req.role === "admin") return next();

  if (req.user.status !== "approved") {
    return next(new ApiError(403, AUTH.ACCOUNT_PENDING));
  }

  next();
};

export { authenticate, requireApproved };
