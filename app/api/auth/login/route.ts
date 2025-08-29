import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validations';
import { verifyPassword } from '@/lib/password';
import { generateAccessToken, generateRefreshToken } from '@/lib/authTokens';
import { query } from '@/lib/db';
import { AuthResponse } from '@/types/auth';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed',
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Find user by email
    const userResult = await query(
      'SELECT id, email, password_hash, first_name, last_name, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    // Generate tokens
    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken({
        userId: user.id,
        email: user.email,
      }),
      generateRefreshToken({
        userId: user.id,
        email: user.email,
      }),
    ]);

    // Hash refresh token before storing
    const refreshTokenHash = await hashPassword(refreshToken);

    // Store refresh token in database
    const expiresAt = new Date(
      Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800') * 1000
    );

    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, expiresAt]
    );

    // Create the response
    const response: AuthResponse = {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };

    // Create response object
    const nextResponse = NextResponse.json(response);

    // Set access token cookie
    nextResponse.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1800, // 30 minutes
      path: '/',
    });

    // Set refresh token cookie
    nextResponse.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800, // 7 days
      path: '/',
    });

    return nextResponse;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while logging in. Please try again.',
      },
      { status: 500 }
    );
  }
}
