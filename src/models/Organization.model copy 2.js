// src/models/Organization.model.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ACCOUNT_STATUS, LANGUAGES } from "../constants/index.js";

const organizationSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // Organization Details
    // --------------------------------------------------

    name: {
      type: String,
      required: true,
      trim: true,
    },

    /*
     * Organization type is now ADMIN-MANAGED.
     *
     * Do NOT use:
     * enum: ORG_TYPES
     *
     * The value should be the dynamic category key coming
     * from the admin-managed organization categories.
     *
     * Example:
     * "masjid"
     * "madrasa_boys"
     * "madrasa_girls"
     * "school"
     *
     * But these are NOT hard-coded here anymore.
     */
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // --------------------------------------------------
    // Contact
    // --------------------------------------------------

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

    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

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

    otpPurpose: {
      type: String,
      enum: ["email_verification", "password_reset", "login_verification"],
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

    // --------------------------------------------------
    // Account Status
    // --------------------------------------------------

    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
      index: true,
    },

    statusNote: {
      type: String,
      default: "",
      trim: true,
    },

    blocked: {
      type: Boolean,
      default: false,
    },

    suspended: {
      type: Boolean,
      default: false,
    },

    // --------------------------------------------------
    // Organization Contact Person
    // --------------------------------------------------

    contactPerson: {
      type: String,
      default: "",
      trim: true,
    },

    // --------------------------------------------------
    // Address
    // --------------------------------------------------

    address: {
      country: {
        type: String,
        default: "IN",
        trim: true,
      },

      state: {
        type: String,
        default: "",
        trim: true,
      },

      district: {
        type: String,
        default: "",
        trim: true,
      },

      city: {
        type: String,
        default: "",
        trim: true,
      },

      fullAddress: {
        type: String,
        default: "",
        trim: true,
      },

      pincode: {
        type: String,
        default: "",
        trim: true,
      },
    },

    // --------------------------------------------------
    // Documents
    // --------------------------------------------------

    documents: {
      type: [String],
      default: [],
    },

    // --------------------------------------------------
    // Notifications
    // --------------------------------------------------

    fcmToken: {
      type: String,
      default: "",
      trim: true,
    },

    // --------------------------------------------------
    // Language
    // --------------------------------------------------

    language: {
      type: String,
      enum: LANGUAGES,
      default: "en",
    },
  },
  {
    timestamps: true,
  },
);

// ------------------------------------------------------
// Password Hashing
// ------------------------------------------------------

organizationSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

// ------------------------------------------------------
// Password Comparison
// ------------------------------------------------------

organizationSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ------------------------------------------------------
// Safe JSON
// ------------------------------------------------------

organizationSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  delete obj.otpCode;
  delete obj.otpExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

// ------------------------------------------------------
// Model
// ------------------------------------------------------

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
