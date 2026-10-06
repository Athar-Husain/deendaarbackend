// backend / src / services / sms.service.js;
import logger from "../utils/logger.js";

const sendSms = async (mobile, message) => {
  logger.info(`[SMS] to=${mobile} message=${message}`);
  return { queued: true };
};

const sendOtpSms = (mobile, otp) =>
  sendSms(mobile, `Your DEENDAAR OTP is ${otp}. Valid for 10 minutes.`);

export { sendSms, sendOtpSms };
