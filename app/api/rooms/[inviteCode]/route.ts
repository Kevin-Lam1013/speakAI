import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/authTokens';

export async function GET(request: NextRequest, { params }: { params: { inviteCode: string } }) {
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
      `SELECT r.id::text, r.name, r.invite_code, r.creator_id::text, r.status, r.created_at,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name
       FROM rooms r
       JOIN users u ON r.creator_id = u.id
       WHERE r.invite_code = $1 AND r.status = 'active'`,
      [params.inviteCode]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found or has ended' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // Get current participants
    const participantsResult = await query(
      `SELECT u.id::text, u.first_name, u.last_name, rp.joined_at
       FROM room_participants rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = $1 AND rp.left_at IS NULL
       ORDER BY rp.joined_at ASC`,
      [room.id]
    );

    // Upsert participant atomically — handles concurrent GET calls (e.g. React StrictMode)
    // and rejoin after leaving. ON CONFLICT resets left_at so the user shows as active.
    await query(
      `INSERT INTO room_participants (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL, joined_at = NOW()`,
      [room.id, userId]
    );

    return NextResponse.json({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        inviteCode: room.invite_code,
        creatorId: room.creator_id,
        creatorName: `${room.creator_first_name} ${room.creator_last_name}`,
        status: room.status,
        createdAt: room.created_at,
        participants: participantsResult.rows.map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          joinedAt: p.joined_at,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch room details' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { inviteCode: string } }) {
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
      "SELECT id::text, name, invite_code, creator_id::text, status, created_at FROM rooms WHERE invite_code = $1 AND status = 'active'",
      [params.inviteCode]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Room not found or has ended' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // Upsert atomically — idempotent and race-condition-safe.
    await query(
      `INSERT INTO room_participants (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO UPDATE SET left_at = NULL, joined_at = NOW()`,
      [room.id, userId]
    );

    return NextResponse.json({
      success: true,
      message: 'Joined room successfully',
      room: {
        id: room.id,
        name: room.name,
        inviteCode: room.invite_code,
        creatorId: room.creator_id,
        status: room.status,
        createdAt: room.created_at,
      },
    });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ success: false, message: 'Failed to join room' }, { status: 500 });
  }
}
