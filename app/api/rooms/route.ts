import { NextRequest, NextResponse } from 'next/server';
import { createRoomSchema } from '@/lib/validations/room';
import { generateUniqueInviteCode } from '@/lib/utils/inviteCode';
import { query } from '@/lib/db';
import { verifyAccessToken } from '@/lib/authTokens';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyAccessToken(accessToken);
    const { userId } = decoded;

    // Get all rooms where the user is a participant
    const result = await query(
      `SELECT DISTINCT r.id::text, r.name, r.invite_code, r.creator_id::text, r.status, r.created_at
       FROM rooms r
       JOIN room_participants rp ON r.id = rp.room_id
       WHERE rp.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    return NextResponse.json(
      result.rows.map(room => ({
        id: room.id,
        name: room.name,
        inviteCode: room.invite_code,
        creatorId: room.creator_id,
        status: room.status,
        createdAt: room.created_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyAccessToken(accessToken);
    const { userId } = decoded;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createRoomSchema.parse(body);

    // Generate a unique invite code
    const inviteCode = await generateUniqueInviteCode(async code => {
      const result = await query('SELECT id FROM rooms WHERE invite_code = $1', [code]);
      return result.rows.length > 0;
    });

    // Create the room
    const result = await query(
      `INSERT INTO rooms (name, invite_code, creator_id)
       VALUES ($1, $2, $3)
       RETURNING id::text, name, invite_code, creator_id::text, status, created_at`,
      [validatedData.name, inviteCode, userId]
    );

    const room = result.rows[0];

    // Add creator as first participant
    await query('INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2)', [
      room.id,
      userId,
    ]);

    return NextResponse.json(
      {
        success: true,
        message: 'Room created successfully',
        room: {
          id: room.id,
          name: room.name,
          inviteCode: room.invite_code,
          creatorId: room.creator_id,
          status: room.status,
          createdAt: room.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating room:', error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid room data', errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, message: 'Failed to create room' }, { status: 500 });
  }
}
