import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Applicant",
      required: true,
      index: true,
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
    },

    lastMessage: {
      type: String,
      default: "",
      maxlength: 200,
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// One conversation between one applicant and one organization.
conversationSchema.index({ applicant: 1, organization: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);
