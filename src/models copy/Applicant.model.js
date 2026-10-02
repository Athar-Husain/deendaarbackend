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

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
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
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      fullAddress: { type: String, default: "" },
      pinCode: { type: String, default: "" },
    },

    qualifications: {
      hafiz: { type: Boolean, default: false },
      qari: { type: Boolean, default: false },
      aalim: { type: Boolean, default: false },
      mufti: { type: Boolean, default: false },
      others: { type: [String], default: [] },
    },

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
        name: { type: String, default: "" },
        role: { type: String, default: "" },
        from: { type: Date },
        to: { type: Date },
      },
    ],

    documents: {
      profilePhoto: { type: String, default: "" },
      idProof: { type: String, default: "" },
      certificates: { type: [String], default: [] },
      cv: { type: String, default: "" },
    },

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

// Keep function syntax here because Mongoose needs `this`.
applicantSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

applicantSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

applicantSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

const Applicant = mongoose.model("Applicant", applicantSchema);

export default Applicant;
