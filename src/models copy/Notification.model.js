import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../constants/index.js";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    recipientModel: {
      type: String,
      enum: ["Applicant", "Organization", "Admin"],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    body: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },

    data: {
      type: Object,
      default: {},
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Notification", notificationSchema);
