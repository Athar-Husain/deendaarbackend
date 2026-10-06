// backend/src/models/Applicant.model.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ACCOUNT_STATUS, JOB_ROLES, LANGUAGES } from "../constants/index.js";

const applicantSchema = new mongoose.Schema(
  {
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

    // ============================================================
    // EMAIL VERIFICATION
    // ============================================================

    emailVerified: {
      type: Boolean,
      default: false,
    },

    // OTP used during signup/email verification.
    // select:false prevents it from being returned by normal queries.
    otpCode: {
      type: String,
      select: false,
    },

    // OTP expiration time.
    otpExpires: {
      type: Date,
      select: false,
    },

    otpPurpose: {
      type: String,
      enum: ["email_verification", "password_reset", "login_verification"],
      select: false,
    },

    // ============================================================
    // PASSWORD RESET
    // ============================================================

    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },

    // ============================================================
    // ACCOUNT STATUS
    // ============================================================

    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.UPDATE_REQUESTED,
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

    // ============================================================
    // PERSONAL INFORMATION
    // ============================================================

    name: {
      type: String,
      trim: true,
    },

    fatherName: {
      type: String,
      trim: true,
    },

    dob: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["male", "female", ""],
    },

    whatsapp: {
      type: String,
      trim: true,
    },

    address: {
      country: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      district: {
        type: String,
        default: "",
      },

      fullAddress: {
        type: String,
        default: "",
      },

      pinCode: {
        type: String,
        default: "",
      },
    },

    // ============================================================
    // QUALIFICATIONS
    // ============================================================

    qualifications: {
      hafiz: {
        type: Boolean,
        default: false,
      },

      qari: {
        type: Boolean,
        default: false,
      },

      aalim: {
        type: Boolean,
        default: false,
      },

      mufti: {
        type: Boolean,
        default: false,
      },

      others: {
        type: [String],
        default: [],
      },
    },

    // ============================================================
    // JOB INFORMATION
    // ============================================================

    roles: [
      {
        type: String,
        enum: JOB_ROLES,
      },
    ],

    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
      max: 80,
    },

    previousOrganizations: [
      {
        name: {
          type: String,
          default: "",
        },

        role: {
          type: String,
          default: "",
        },

        from: {
          type: Date,
        },

        to: {
          type: Date,
        },
      },
    ],

    // ============================================================
    // DOCUMENTS
    // ============================================================

    documents: {
      profilePhoto: {
        type: String,
        default: "",
      },

      idProof: {
        type: String,
        default: "",
      },

      certificates: {
        type: [String],
        default: [],
      },

      cv: {
        type: String,
        default: "",
      },
    },

    // ============================================================
    // JOB PREFERENCES
    // ============================================================

    preferences: {
      preferredRole: {
        type: String,
        enum: [...JOB_ROLES, ""],
        default: "",
      },

      expectedSalary: {
        type: Number,
        default: 0,
      },

      preferredLocation: {
        type: String,
        default: "",
      },

      accommodationRequired: {
        type: Boolean,
        default: false,
      },
    },

    // ============================================================
    // PUSH NOTIFICATIONS
    // ============================================================

    fcmToken: {
      type: String,
      default: "",
    },

    // ============================================================
    // LANGUAGE
    // ============================================================

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

// ============================================================
// PASSWORD HASHING
// ============================================================

applicantSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

// ============================================================
// PASSWORD COMPARISON
// ============================================================

applicantSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ============================================================
// SAFE USER RESPONSE
// ============================================================

applicantSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();

  delete obj.password;

  // Never expose verification information.
  delete obj.otpCode;
  delete obj.otpExpires;

  // Password reset information must also never leave the backend.
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

const Applicant = mongoose.model("Applicant", applicantSchema);

export default Applicant;
