// backend/src/utils/otp.js
import crypto from "crypto";

function generateOtp(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);

  return num.toString().padStart(length, "0");
}

function otpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export { generateOtp, otpExpiry };
