import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    labelEn: { type: String, required: true },
    labelUr: { type: String, default: "" },
    labelAr: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Role", roleSchema);
