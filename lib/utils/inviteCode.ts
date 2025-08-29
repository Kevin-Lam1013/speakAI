import { customAlphabet } from 'nanoid';

// Create a custom nanoid generator that uses only uppercase letters and numbers
// This makes invite codes more user-friendly and easier to type/share
const generateId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

export async function generateUniqueInviteCode(
  checkExists: (code: string) => Promise<boolean>
): Promise<string> {
  let inviteCode: string;
  let exists: boolean;

  // Keep generating codes until we find a unique one
  do {
    inviteCode = generateId();
    exists = await checkExists(inviteCode);
  } while (exists);

  return inviteCode;
}
