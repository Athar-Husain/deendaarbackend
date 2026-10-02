// src/models/Organization.model.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ACCOUNT_STATUS, ORG_TYPES, LANGUAGES } from "../constants/index.js";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ORG_TYPES,
      required: true,
    },

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

    password: {
      type: String,
      required: true,
      select: false,
    },

    otpVerified: {
      type: Boolean,
      default: false,
    },

    otpCode: {
      type: String,
      select: false,
    },

    otpExpires: {
      type: Date,
      select: false,
    },

    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
      index: true,
    },

    statusNote: {
      type: String,
      default: "",
    },

    blocked: {
      type: Boolean,
      default: false,
    },

    suspended: {
      type: Boolean,
      default: false,
    },

    contactPerson: {
      type: String,
      default: "",
    },

    address: {
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      fullAddress: { type: String, default: "" },
      pinCode: { type: String, default: "" },
    },

    documents: {
      type: [String],
      default: [],
    },

    fcmToken: {
      type: String,
      default: "",
    },

    language: {
      type: String,
      enum: LANGUAGES,
      default: "en",
    },
  },
  { timestamps: true },
);

// ✅ Corrected pre-save hook (Removed `next`)
organizationSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

organizationSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

organizationSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  delete obj.otpCode;
  delete obj.otpExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
