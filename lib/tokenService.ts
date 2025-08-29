import { query } from './db';
import { hashPassword } from './password';
import { generateAccessToken, generateRefreshToken, JWTPayload } from './authTokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate both access and refresh tokens and persist refresh token hash
 */
export async function generateTokenPair(userId: number, email: string): Promise<TokenPair> {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = { userId, email };

  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);

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
 * Clean expired refresh tokens from database
 */
export async function cleanExpiredTokens(): Promise<void> {
  await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
}
