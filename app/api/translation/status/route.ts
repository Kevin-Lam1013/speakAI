import { NextResponse } from 'next/server';

// Placeholder: expose minimal status for debugging (to be wired to server memory if needed)
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Translation status placeholder' });
}
