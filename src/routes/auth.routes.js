// backend/src/routes/auth.routes.js

import express from "express";
import * as ctrl from "../controllers/auth.controller.js";

import { validate } from "../middleware/validate.middleware.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimit.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import v from "../validations/auth.validation.js";

const router = express.Router();

/* -------------------- APPLICANT -------------------- */
router.post(
  "/applicant/signup",
  authLimiter,
  validate(v.applicantSignup),
  ctrl.applicantSignup,
);
router.post(
  "/applicant/verify-otp",
  otpLimiter,
  validate(v.verifyOtp),
  ctrl.applicantVerifyOtp,
);
router.post(
  "/applicant/resend-otp",
  otpLimiter,
  validate(v.resendOtp),
  ctrl.applicantResendOtp,
);
router.post(
  "/applicant/login",
  authLimiter,
  validate(v.login),
  ctrl.applicantLogin,
);

/* -------------------- ORGANIZATION -------------------- */
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
  validate(v.resendOtp),
  ctrl.orgResendOtp,
);
router.post("/org/login", authLimiter, validate(v.login), ctrl.orgLogin);

/* -------------------- PASSWORD RESET -------------------- */
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

/* -------------------- TOKEN -------------------- */
router.post("/refresh", validate(v.refreshToken), ctrl.refresh);

/* -------------------- ME -------------------- */
router.get("/me", authenticate, ctrl.me);

export default router;
