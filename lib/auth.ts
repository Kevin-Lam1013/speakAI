import jwt from 'jsonwebtoken';
import { query } from './db';
import { hashPassword } from './password';
import { JWTPayload, generateAccessToken } from './jwt';

export type { JWTPayload };
export { generateAccessToken, verifyAccessToken } from './jwt';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '604800'; // 7 days

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }

  return jwt.sign(payload, secret, {
    expiresIn: parseInt(expiresIn),
  });
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(userId: number, email: string): Promise<TokenPair> {
  const payload = { userId, email };

  const accessToken = await generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token hash in database
  const refreshTokenHash = await hashPassword(refreshToken);
  const expiresAt = new Date(
    Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800') * 1000
  );

  await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    userId,
    refreshTokenHash,
    expiresAt,
  ]);

  return { accessToken, refreshToken };
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(userId: number, token: string): Promise<void> {
  // In a real implementation, you might want to verify the token first
  // For now, we'll remove all refresh tokens for the user
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

/**
 * Clean expired refresh tokens
 */
export async function cleanExpiredTokens(): Promise<void> {
  await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
}
