// backend/src/routes/auth.routes.js
import express from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimit.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import v from "../validations/auth.validation.js";

const router = express.Router();

router.post(
  "/applicant/signup",
  authLimiter,
  validate(v.applicantSignup),
  ctrl.applicantSignup,
);
router.post(
  "/applicant/verify-email",
  validate(v.verifyEmail),
  ctrl.verifyEmail,
);
router.post(
  "/applicant/login",
  authLimiter,
  validate(v.login),
  ctrl.applicantLogin,
);

router.post("/org/signup", authLimiter, validate(v.orgSignup), ctrl.orgSignup);
router.post(
  "/org/verify-otp",
  otpLimiter,
  validate(v.verifyOtp),
  ctrl.orgVerifyOtp,
);
router.post(
  "/org/resend-otp",
  otpLimiter,
  validate(v.forgotPassword),
  ctrl.orgResendOtp,
);
router.post("/org/login", authLimiter, validate(v.login), ctrl.orgLogin);

router.post(
  "/forgot-password",
  authLimiter,
  validate(v.forgotPassword),
  ctrl.forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validate(v.resetPassword),
  ctrl.resetPassword,
);
router.post("/refresh", validate(v.refreshToken), ctrl.refresh);
router.get("/me", authenticate, ctrl.me);

export default router;
