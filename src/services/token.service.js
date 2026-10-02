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

export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokens,
};
