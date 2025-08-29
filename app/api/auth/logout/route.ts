import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/authTokens';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get access token from cookie to identify the user
    const accessToken = request.cookies.get('accessToken')?.value;

    if (accessToken) {
      try {
        // Get user ID from the token
        const decoded = await verifyAccessToken(accessToken);

        // Delete all refresh tokens for this user from the database
        await query('DELETE FROM refresh_tokens WHERE user_id = $1', [decoded.userId]);
      } catch (error) {
        // Token might be invalid, but we still want to proceed with logout
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    );

    // Clear access token cookie
    response.cookies.set('accessToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while logging out',
      },
      { status: 500 }
    );
  }
}
