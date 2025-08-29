import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(255, 'Room name must be less than 255 characters'),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().length(10, 'Invalid invite code'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
