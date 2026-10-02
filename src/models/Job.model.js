import mongoose from "mongoose";
import { JOB_ROLES, JOB_STATUS } from "../constants/index.js";

const jobSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      enum: JOB_ROLES,
      required: true,
      index: true,
    },

    salary: {
      type: Number,
      default: 0,
      min: 0,
    },

    location: {
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      fullAddress: { type: String, default: "" },
    },

    accommodation: {
      type: Boolean,
      default: false,
    },

    requirements: {
      hafiz: { type: Boolean, default: false },
      qari: { type: Boolean, default: false },
      aalim: { type: Boolean, default: false },
      mufti: { type: Boolean, default: false },
      notes: { type: String, default: "" },
    },

    description: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.OPEN,
      index: true,
    },

    applicantsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

jobSchema.index({ title: "text", description: "text" });
jobSchema.index({ "location.district": 1, role: 1, status: 1 });

export default mongoose.model("Job", jobSchema);
