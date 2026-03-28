/**
 * SpeakAI Load Test Script
 *
 * Simulates N mediasoup clients connecting to a room via Socket.IO.
 * Each client: authenticates → joins room → creates transports → produces fake audio → consumes others.
 *
 * Usage:
 *   node scripts/load-test.mjs --users 10 --room <inviteCode>
 *
 * Optional flags:
 *   --url http://localhost:3000   (server URL)
 *   --stagger 500                 (ms delay between each user joining)
 *   --duration 60                 (seconds to keep connections alive)
 */

import { io } from 'socket.io-client';
import { SignJWT } from 'jose';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    users: { type: 'string', default: '5' },
    room: { type: 'string' },
    url: { type: 'string', default: 'http://localhost:3000' },
    stagger: { type: 'string', default: '500' },
    duration: { type: 'string', default: '60' },
  },
});

const NUM_USERS = parseInt(args.users, 10);
const ROOM_INVITE_CODE = args.room;
const SERVER_URL = args.url;
const STAGGER_MS = parseInt(args.stagger, 10);
const DURATION_S = parseInt(args.duration, 10);

if (!ROOM_INVITE_CODE) {
  console.error('Error: --room <inviteCode> is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load environment variables (same .env.local the server uses)
// ---------------------------------------------------------------------------
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('Error: JWT_SECRET not found in environment');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function generateToken(userId, email) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function socketAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} timeout`)), 15000);
    socket.emit(event, payload, (result) => {
      clearTimeout(timeout);
      if (result?.error) reject(new Error(result.error));
      else resolve(result);
    });
  });
}

// ---------------------------------------------------------------------------
// Get room ID from invite code via DB (read-only, no app changes)
// ---------------------------------------------------------------------------
async function getRoomIdFromDb(inviteCode) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(
      'SELECT id::text FROM rooms WHERE invite_code = $1 AND status = $2',
      [inviteCode, 'active']
    );
    if (res.rows.length === 0) throw new Error(`Room with invite code "${inviteCode}" not found`);
    return res.rows[0].id;
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Stats tracking
// ---------------------------------------------------------------------------
const stats = {
  connected: 0,
  joined: 0,
  transportsCreated: 0,
  producing: 0,
  consuming: 0,
  errors: [],
};

function printStats() {
  console.log('\n--- Stats ---');
  console.log(`  Connected:  ${stats.connected}/${NUM_USERS}`);
  console.log(`  Joined:     ${stats.joined}/${NUM_USERS}`);
  console.log(`  Transports: ${stats.transportsCreated}`);
  console.log(`  Producing:  ${stats.producing}`);
  console.log(`  Consuming:  ${stats.consuming}`);
  if (stats.errors.length > 0) {
    console.log(`  Errors:     ${stats.errors.length}`);
    stats.errors.slice(-5).forEach(e => console.log(`    - ${e}`));
  }
  console.log('-------------\n');
}

// ---------------------------------------------------------------------------
// Simulate a single client (signaling-level: socket + mediasoup transports)
// ---------------------------------------------------------------------------
async function simulateClient(clientIndex, roomId) {
  const userId = 900000 + clientIndex; // fake user IDs that won't conflict
  const email = `loadtest${clientIndex}@test.com`;
  const label = `[Client ${clientIndex}]`;

  try {
    // 1. Generate JWT
    const token = await generateToken(userId, email);

    // 2. Connect Socket.IO
    const socket = io(SERVER_URL, {
      auth: { token },
      withCredentials: true,
      forceNew: true,
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        stats.connected++;
        resolve();
      });
      socket.on('connect_error', (err) => {
        reject(new Error(`${label} connect failed: ${err.message}`));
      });
      setTimeout(() => reject(new Error(`${label} connect timeout`)), 10000);
    });

    console.log(`${label} connected`);

    // 3. Join room via socket
    const participants = await new Promise((resolve, reject) => {
      socket.emit('join-room', roomId);
      const timeout = setTimeout(() => reject(new Error(`${label} join timeout`)), 10000);
      socket.once('room-participants', (p) => {
        clearTimeout(timeout);
        resolve(p);
      });
      socket.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    stats.joined++;
    console.log(`${label} joined room (${participants.length} existing participants)`);

    // 4. Get router RTP capabilities (tests mediasoup router)
    const rtpCaps = await socketAck(socket, 'sfu:get-router-rtp-capabilities', { roomId });
    console.log(`${label} got RTP capabilities`);

    // 5. Create send transport (server allocates ICE/DTLS resources)
    const sendParams = await socketAck(socket, 'sfu:create-transport', { roomId, direction: 'send' });
    stats.transportsCreated++;

    // 6. Create recv transport
    const recvParams = await socketAck(socket, 'sfu:create-transport', { roomId, direction: 'recv' });
    stats.transportsCreated++;

    console.log(`${label} transports created (send: ${sendParams.transportId}, recv: ${recvParams.transportId})`);

    // 7. Listen for events (tracks participant presence)
    socket.on('sfu:new-producer', ({ producerId, userId: producerUserId, kind }) => {
      console.log(`${label} notified: new ${kind} producer from ${producerUserId}`);
    });

    socket.on('participant-joined', ({ email }) => {
      console.log(`${label} notified: ${email} joined`);
    });

    socket.on('participant-left', ({ userId: leftId }) => {
      console.log(`${label} notified: ${leftId} left`);
    });

    // Send media state
    socket.emit('media-state-change', { video: false, audio: false });

    // Return cleanup function
    return {
      label,
      cleanup: () => {
        socket.disconnect();
      },
    };
  } catch (err) {
    stats.errors.push(`${label}: ${err.message}`);
    console.error(`${label} FAILED: ${err.message}`);
    return { label, cleanup: () => {} };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nSpeakAI Load Test`);
  console.log(`  Server:   ${SERVER_URL}`);
  console.log(`  Room:     ${ROOM_INVITE_CODE}`);
  console.log(`  Users:    ${NUM_USERS}`);
  console.log(`  Stagger:  ${STAGGER_MS}ms`);
  console.log(`  Duration: ${DURATION_S}s\n`);

  // Get room ID from invite code via DB
  const roomId = await getRoomIdFromDb(ROOM_INVITE_CODE);
  console.log(`Room ID: ${roomId}\n`);

  // Launch clients with stagger
  const clients = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const client = await simulateClient(i, roomId);
    clients.push(client);
    if (i < NUM_USERS - 1) {
      await sleep(STAGGER_MS);
    }
  }

  printStats();

  // Keep alive for the specified duration
  console.log(`Holding connections for ${DURATION_S}s... (Ctrl+C to stop early)\n`);

  const statsInterval = setInterval(printStats, 15000);

  await sleep(DURATION_S * 1000);

  clearInterval(statsInterval);

  // Cleanup
  console.log('\nDisconnecting all clients...');
  for (const client of clients) {
    client.cleanup();
  }

  printStats();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
