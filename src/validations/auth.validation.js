// backend/src/validations/auth.validation.js

import Joi from "joi";

import { JOB_ROLES, LANGUAGES } from "../constants/index.js";

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const MOBILE_REGEX = /^[+]?[0-9]{7,15}$/;

const OTP_REGEX = /^[0-9]{6}$/;

const PINCODE_REGEX = /^[0-9]{6}$/;

/*
|--------------------------------------------------------------------------
| COMMON SCHEMAS
|--------------------------------------------------------------------------
*/

const email = Joi.string().trim().lowercase().email().required().messages({
  "string.empty": "Email is required.",
  "string.email": "Please provide a valid email address.",
  "any.required": "Email is required.",
});

const password = Joi.string().min(8).max(64).required().messages({
  "string.empty": "Password is required.",
  "string.min": "Password must be at least 8 characters.",
  "string.max": "Password cannot exceed 64 characters.",
  "any.required": "Password is required.",
});

const mobile = Joi.string().trim().pattern(MOBILE_REGEX).required().messages({
  "string.empty": "Mobile number is required.",
  "string.pattern.base": "Mobile number is invalid.",
  "any.required": "Mobile number is required.",
});

const otp = Joi.string().trim().pattern(OTP_REGEX).required().messages({
  "string.empty": "OTP is required.",
  "string.pattern.base": "OTP must be a 6-digit number.",
  "any.required": "OTP is required.",
});

/*
|--------------------------------------------------------------------------
| COMMON LOCATION SCHEMAS
|--------------------------------------------------------------------------
*/

const country = Joi.string().trim().min(2).max(100).required().messages({
  "string.empty": "Country is required.",
  "string.min": "Country must be at least 2 characters.",
  "string.max": "Country cannot exceed 100 characters.",
  "any.required": "Country is required.",
});

const state = Joi.string().trim().min(2).max(100).required().messages({
  "string.empty": "State is required.",
  "string.min": "State must be at least 2 characters.",
  "string.max": "State cannot exceed 100 characters.",
  "any.required": "State is required.",
});

const city = Joi.string().trim().min(2).max(100).required().messages({
  "string.empty": "City is required.",
  "string.min": "City must be at least 2 characters.",
  "string.max": "City cannot exceed 100 characters.",
  "any.required": "City is required.",
});

const pincode = Joi.string().trim().pattern(PINCODE_REGEX).required().messages({
  "string.empty": "Pincode is required.",
  "string.pattern.base": "Pincode must contain exactly 6 digits.",
  "any.required": "Pincode is required.",
});

const fullAddress = Joi.string().trim().min(5).max(500).required().messages({
  "string.empty": "Full address is required.",
  "string.min": "Please provide a more complete address.",
  "string.max": "Address cannot exceed 500 characters.",
  "any.required": "Full address is required.",
});

/*
|--------------------------------------------------------------------------
| APPLICANT SIGNUP
|--------------------------------------------------------------------------
*/

export const applicantSignup = Joi.object({
  mobile,

  email,

  password,

  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required.",
    "string.min": "Name must be at least 2 characters.",
    "string.max": "Name cannot exceed 100 characters.",
    "any.required": "Name is required.",
  }),

  /*
  |--------------------------------------------------------------------------
  | LOCATION
  |--------------------------------------------------------------------------
  */

  country,

  state,

  city,

  pincode,

  fullAddress,

  /*
  |--------------------------------------------------------------------------
  | LANGUAGE
  |--------------------------------------------------------------------------
  */

  language: Joi.string()
    .valid(...LANGUAGES)
    .default("en"),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| ORGANIZATION SIGNUP
|--------------------------------------------------------------------------
|
| Organization type is intentionally NOT restricted by ORG_TYPES.
|
| The admin panel controls organization types dynamically.
|--------------------------------------------------------------------------
*/

export const orgSignup = Joi.object({
  name: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "Organization name is required.",
    "string.min": "Organization name must be at least 2 characters.",
    "string.max": "Organization name cannot exceed 150 characters.",
    "any.required": "Organization name is required.",
  }),

  type: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Organization type is required.",
    "string.min": "Organization type must be at least 2 characters.",
    "string.max": "Organization type cannot exceed 100 characters.",
    "any.required": "Organization type is required.",
  }),

  /*
  |--------------------------------------------------------------------------
  | LOCATION
  |--------------------------------------------------------------------------
  */

  country,

  state,

  city,

  pincode,

  fullAddress,

  /*
  |--------------------------------------------------------------------------
  | ACCOUNT
  |--------------------------------------------------------------------------
  */

  mobile,

  email,

  password,

  language: Joi.string()
    .valid(...LANGUAGES)
    .default("en"),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

export const login = Joi.object({
  email,

  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| VERIFY OTP
|--------------------------------------------------------------------------
*/

export const verifyOtp = Joi.object({
  email,

  otp,
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| LEGACY EMAIL VERIFICATION
|--------------------------------------------------------------------------
*/

export const verifyEmail = Joi.object({
  token: Joi.string().trim().required().messages({
    "string.empty": "Verification token is required.",
    "any.required": "Verification token is required.",
  }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/

export const forgotPassword = Joi.object({
  email,
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
|
| New flow:
|
| email + OTP + new password
|--------------------------------------------------------------------------
*/

export const resetPassword = Joi.object({
  email,

  otp,

  password,
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| REFRESH TOKEN
|--------------------------------------------------------------------------
*/

export const refreshToken = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    "string.empty": "Refresh token is required.",
    "any.required": "Refresh token is required.",
  }),
}).options({
  abortEarly: false,
  stripUnknown: true,
});

export const resendOtp = Joi.object({
  email,
}).options({
  abortEarly: false,
  stripUnknown: true,
});

/*
|--------------------------------------------------------------------------
| JOB ROLE ENUM
|--------------------------------------------------------------------------
*/

export const rolesEnum = Joi.string().valid(...JOB_ROLES);

/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

export default {
  resendOtp,
  applicantSignup,
  orgSignup,
  login,
  verifyOtp,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  rolesEnum,
};
