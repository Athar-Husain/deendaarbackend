// backend/src/services/token.service.js
import jwt from "jsonwebtoken";
import { jwt as jwtCfg } from "../config/env.js";

const signAccessToken = (payload) =>
  jwt.sign(payload, jwtCfg.accessSecret, {
    expiresIn: jwtCfg.accessExpires,
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, jwtCfg.refreshSecret, {
    expiresIn: jwtCfg.refreshExpires,
  });

const verifyAccessToken = (token) => jwt.verify(token, jwtCfg.accessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, jwtCfg.refreshSecret);

const issueTokens = (payload) => ({
  accessToken: signAccessToken(payload),
  refreshToken: signRefreshToken(payload),
});

// export const issueTokens = (payload) => {
//   const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "15m" });
//   const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
//   return { accessToken, refreshToken };
// };

export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
};
