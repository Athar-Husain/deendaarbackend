import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    country: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

locationSchema.index({ country: 1, state: 1, district: 1 }, { unique: true });

export default mongoose.model("Location", locationSchema);
