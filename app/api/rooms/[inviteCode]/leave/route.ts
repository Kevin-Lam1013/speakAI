import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/jwt';

export async function PUT(request: NextRequest, { params }: { params: { inviteCode: string } }) {
  try {
    // Verify user is authenticated
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyAccessToken(accessToken);
    const { userId } = decoded;

    // Get room details
    const roomResult = await query(
      "SELECT id::text FROM rooms WHERE invite_code = $1 AND status = 'active'",
      [params.inviteCode]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found or has ended' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // Mark participant as left
    await query(
      `UPDATE room_participants
       SET left_at = CURRENT_TIMESTAMP
       WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [room.id, userId]
    );

    return NextResponse.json({
      success: true,
      message: 'Left room successfully',
    });
  } catch (error) {
    console.error('Error leaving room:', error);
    return NextResponse.json({ success: false, message: 'Failed to leave room' }, { status: 500 });
  }
}
