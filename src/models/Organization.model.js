// backend/src/models/Organization.model.js

// backend/src/models/Organization.model.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ACCOUNT_STATUS, LANGUAGES } from "../constants/index.js";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Admin-managed category key — NOT hard-coded
    type: { type: String, required: true, trim: true, index: true },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: { type: String, required: true, select: false },

    // -------------------- EMAIL OTP --------------------
    otpVerified: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpPurpose: {
      type: String,
      enum: ["email_verification", "password_reset", "login_verification"],
      select: false,
    },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    // -------------------- ACCOUNT STATUS --------------------
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
      index: true,
    },
    statusNote: { type: String, default: "", trim: true },
    blocked: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },

    // -------------------- PROFILE COMPLETION --------------------
    profileComplete: { type: Boolean, default: false, index: true },
    documentsSubmittedAt: { type: Date, default: null },

    // -------------------- CONTACT PERSON --------------------
    contactPerson: { type: String, default: "", trim: true },

    // -------------------- ADDRESS --------------------
    address: {
      country: { type: String, default: "IN", trim: true },
      state: { type: String, default: "", trim: true },
      district: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
      fullAddress: { type: String, default: "", trim: true },
      pincode: { type: String, default: "", trim: true },
    },

    // -------------------- DOCUMENTS --------------------
    documents: { type: [String], default: [] },

    // -------------------- PUSH --------------------
    fcmToken: { type: String, default: "", trim: true },

    // -------------------- LANGUAGE --------------------
    language: { type: String, enum: LANGUAGES, default: "en" },
  },
  { timestamps: true },
);

organizationSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  const docs = Array.isArray(this.documents) ? this.documents : [];
  this.profileComplete = docs.length > 0;
});

organizationSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

organizationSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otpCode;
  delete obj.otpExpires;
  delete obj.otpPurpose;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;
