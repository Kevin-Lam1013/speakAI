import { NextRequest, NextResponse } from 'next/server';
import { signupSchema } from '@/lib/validations';
import { hashPassword } from '@/lib/password';
import { generateTokenPair } from '@/lib/tokenService';
import { query } from '@/lib/db';
import { AuthResponse } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = signupSchema.safeParse(body);
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

    const { email, password, firstName, lastName } = validationResult.data;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'An account with this email already exists',
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, first_name, last_name, created_at, updated_at`,
      [email, passwordHash, firstName, lastName]
    );

    const user = userResult.rows[0];

    // Generate and persist tokens
    const { accessToken, refreshToken } = await generateTokenPair(user.id, user.email);

    // Prepare response
    const response: AuthResponse = {
      success: true,
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    };

    // Create response object with cookies
    const nextResponse = NextResponse.json(response, { status: 201 });

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
    console.error('Signup error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while creating your account. Please try again.',
      },
      { status: 500 }
    );
  }
}
