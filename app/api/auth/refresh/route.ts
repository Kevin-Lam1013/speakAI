import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateAccessToken } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          message: 'Refresh token not found',
        },
        { status: 401 }
      );
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid refresh token',
        },
        { status: 401 }
      );
    }

    // Check if refresh token exists in database and is not expired
    const tokenResult = await query(
      'SELECT id FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
      [decoded.userId]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Refresh token expired or revoked',
        },
        { status: 401 }
      );
    }

    // Get user info
    const userResult = await query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found',
        },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Token refreshed successfully',
        accessToken,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while refreshing token',
      },
      { status: 500 }
    );
  }
}
