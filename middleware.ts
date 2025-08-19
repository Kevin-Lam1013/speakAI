import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';

// Define protected and auth routes
const protectedRoutes = ['/dashboard', '/room'];
const authRoutes = ['/login', '/signup'];

// API routes that don't need token verification
const publicApiRoutes = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/logout',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip token verification for public API routes
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get access token from cookie
  const accessToken = request.cookies.get('accessToken')?.value;

  // Check if user is authenticated
  let isAuthenticated = false;
  if (accessToken) {
    try {
      await verifyAccessToken(accessToken);
      isAuthenticated = true;
    } catch (error) {
      isAuthenticated = false;
    }
  }

  // Handle protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // For page requests, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);

      // Clear any invalid cookies
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');

      return response;
    }
  }

  // Handle auth routes (login, signup)
  if (authRoutes.some(route => pathname.startsWith(route))) {
    if (isAuthenticated) {
      // Redirect to dashboard if already authenticated
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // For API routes that require authentication
  if (pathname.startsWith('/api/') && !publicApiRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
  }

  // Return response with modified headers
  const response = NextResponse.next();

  // Add the Authorization header for API routes if authenticated
  if (isAuthenticated && pathname.startsWith('/api/')) {
    response.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
