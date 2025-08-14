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
      'SELECT id::text, creator_id::text, status FROM rooms WHERE invite_code = $1',
      [params.inviteCode]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Room not found' }, { status: 404 });
    }

    const room = roomResult.rows[0];

    // Verify user is room creator
    if (room.creator_id !== userId) {
      return NextResponse.json(
        { success: false, message: 'Only the room creator can end the room' },
        { status: 403 }
      );
    }

    // If room is already ended, return success (idempotent)
    if (room.status === 'ended') {
      return NextResponse.json({
        success: true,
        message: 'Room is already ended',
      });
    }

    // End the room
    await query(
      `UPDATE rooms 
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [room.id]
    );

    // Mark all participants as left
    await query(
      `UPDATE room_participants
       SET left_at = CURRENT_TIMESTAMP
       WHERE room_id = $1 AND left_at IS NULL`,
      [room.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Room ended successfully',
    });
  } catch (error) {
    console.error('Error ending room:', error);
    return NextResponse.json({ success: false, message: 'Failed to end room' }, { status: 500 });
  }
}
