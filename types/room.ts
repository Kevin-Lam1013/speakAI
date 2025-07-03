export type RoomStatus = 'active' | 'ended';

export interface Room {
  id: string;
  name: string;
  creatorId: string;
  status: RoomStatus;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  joinedAt: string;
}

export interface CreateRoomData {
  name: string;
}
