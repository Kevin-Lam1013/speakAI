import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/authTokens';

export async function GET(request: NextRequest) {
  try {
    // Get access token from HTTP-only cookie
    const accessToken = request.cookies.get('accessToken')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: 'No access token found' },
        { status: 401 }
      );
    }

    // Verify the token is valid
    await verifyAccessToken(accessToken);

    // Return the token for socket authentication
    return NextResponse.json({
      success: true,
      accessToken,
    });
  } catch (error) {
    console.error('Error getting access token:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
