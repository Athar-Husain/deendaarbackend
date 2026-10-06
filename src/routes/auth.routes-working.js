// backend/src/routes/auth.routes.js

import express from "express";
import * as ctrl from "../controllers/auth.controller.js";

import { validate } from "../middleware/validate.middleware.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimit.middleware.js";

import { authenticate } from "../middleware/auth.middleware.js";
import v from "../validations/auth.validation.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| APPLICANT AUTH
|--------------------------------------------------------------------------
*/

// Applicant signup
router.post(
  "/applicant/signup",
  authLimiter,
  validate(v.applicantSignup),
  ctrl.applicantSignup,
);

// Applicant email OTP verification
router.post(
  "/applicant/verify-otp",
  otpLimiter,
  validate(v.verifyOtp),
  ctrl.applicantVerifyOtp,
);

// Applicant resend email OTP
router.post(
  "/applicant/resend-otp",
  otpLimiter,
  validate(v.resendOtp),
  ctrl.applicantResendOtp,
);

// Applicant login
router.post(
  "/applicant/login",
  authLimiter,
  validate(v.login),
  ctrl.applicantLogin,
);

/*
|--------------------------------------------------------------------------
| ORGANIZATION AUTH
|--------------------------------------------------------------------------
*/

// Organization signup
router.post("/org/signup", authLimiter, validate(v.orgSignup), ctrl.orgSignup);

// Organization OTP verification
router.post(
  "/org/verify-otp",
  otpLimiter,
  validate(v.verifyOtp),
  ctrl.orgVerifyOtp,
);

// Organization resend OTP
router.post(
  "/org/resend-otp",
  otpLimiter,
  validate(v.resendOtp),
  ctrl.orgResendOtp,
);

// Organization login
router.post("/org/login", authLimiter, validate(v.login), ctrl.orgLogin);

/*
|--------------------------------------------------------------------------
| PASSWORD RESET
|--------------------------------------------------------------------------
*/

// Forgot password
router.post(
  "/forgot-password",
  authLimiter,
  validate(v.forgotPassword),
  ctrl.forgotPassword,
);

// Reset password
router.post(
  "/reset-password",
  authLimiter,
  validate(v.resetPassword),
  ctrl.resetPassword,
);

/*
|--------------------------------------------------------------------------
| TOKEN
|--------------------------------------------------------------------------
*/

// Refresh access token
router.post("/refresh", validate(v.refreshToken), ctrl.refresh);

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

// Get authenticated user
router.get("/me", authenticate, ctrl.me);

export default router;
