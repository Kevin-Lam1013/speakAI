/**
 * SpeakAI Browser Load Test (Playwright)
 *
 * Launches N real Chromium browsers, each signing up as a unique user,
 * joining the same room, enabling camera + mic, and holding the connection.
 * Tests the full end-to-end flow including real WebRTC media.
 *
 * Usage:
 *   node scripts/load-test-browser.mjs --users 20 --room <inviteCode>
 *
 * Optional flags:
 *   --url http://localhost:3000   (server URL)
 *   --stagger 2000               (ms delay between each browser launching)
 *   --duration 60                 (seconds to hold connections)
 *   --headless                    (run browsers in headless mode, default: true)
 *   --enable-media                (toggle camera+mic on after joining)
 */

import { chromium } from 'playwright';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    users: { type: 'string', default: '5' },
    room: { type: 'string' },
    url: { type: 'string', default: 'http://localhost:3000' },
    stagger: { type: 'string', default: '2000' },
    duration: { type: 'string', default: '60' },
    headless: { type: 'boolean', default: true },
    'enable-media': { type: 'boolean', default: false },
  },
});

const NUM_USERS = parseInt(args.users, 10);
const ROOM_INVITE_CODE = args.room;
const SERVER_URL = args.url;
const STAGGER_MS = parseInt(args.stagger, 10);
const DURATION_S = parseInt(args.duration, 10);
const HEADLESS = args.headless;
const ENABLE_MEDIA = args['enable-media'];

if (!ROOM_INVITE_CODE) {
  console.error('Error: --room <inviteCode> is required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
const stats = {
  launched: 0,
  signedUp: 0,
  joinedRoom: 0,
  mediaEnabled: 0,
  errors: [],
};

function printStats() {
  console.log('\n--- Stats ---');
  console.log(`  Launched:      ${stats.launched}/${NUM_USERS}`);
  console.log(`  Signed up:     ${stats.signedUp}/${NUM_USERS}`);
  console.log(`  Joined room:   ${stats.joinedRoom}/${NUM_USERS}`);
  if (ENABLE_MEDIA) {
    console.log(`  Media enabled: ${stats.mediaEnabled}/${NUM_USERS}`);
  }
  if (stats.errors.length > 0) {
    console.log(`  Errors:        ${stats.errors.length}`);
    stats.errors.slice(-5).forEach(e => console.log(`    - ${e}`));
  }
  console.log('-------------\n');
}

// ---------------------------------------------------------------------------
// Launch a single browser user
// ---------------------------------------------------------------------------
async function launchUser(index, browser) {
  const label = `[User ${index}]`;
  const email = `loadtest${index}_${Date.now()}@test.com`;
  const password = 'LoadTest1';
  const firstName = `Load`;
  const lastName = `Test${index}`;

  try {
    // Create browser context with permissions pre-granted
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
    });

    const page = await context.newPage();

    // Suppress console noise from the app
    page.on('pageerror', () => {});

    stats.launched++;
    console.log(`${label} browser launched`);

    // ---- Step 1: Sign up ----
    await page.goto(`${SERVER_URL}/signup`, { waitUntil: 'networkidle' });

    await page.fill('input[name="firstName"]', firstName);
    await page.fill('input[name="lastName"]', lastName);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard after signup
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    stats.signedUp++;
    console.log(`${label} signed up as ${email}`);

    // ---- Step 2: Join room ----
    await page.goto(`${SERVER_URL}/rooms/${ROOM_INVITE_CODE}`, { waitUntil: 'networkidle' });

    // Wait for the room to load — the "Leave Room" button appears when connected
    await page.waitForSelector('button:has-text("Leave Room")', { timeout: 30000 });
    stats.joinedRoom++;
    console.log(`${label} joined room`);

    // ---- Step 3: Optionally enable camera + mic ----
    if (ENABLE_MEDIA) {
      try {
        // Find the control buttons — camera is first IconButton, mic is second
        // RoomControls has camera toggle, then audio toggle, then leave button
        const controlButtons = page.locator('button').filter({ has: page.locator('svg') });

        // Click camera toggle (first media button)
        const cameraBtn = controlButtons.first();
        await cameraBtn.click();
        await sleep(1000);

        // Click mic toggle (second media button)
        const micBtn = controlButtons.nth(1);
        await micBtn.click();
        await sleep(1000);

        stats.mediaEnabled++;
        console.log(`${label} camera + mic enabled`);
      } catch (err) {
        console.log(`${label} media toggle failed: ${err.message}`);
      }
    }

    return {
      label,
      context,
      page,
      cleanup: async () => {
        try {
          // Click leave room if possible
          const leaveBtn = page.locator('button:has-text("Leave Room")');
          if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await leaveBtn.click();
            await sleep(500);
          }
        } catch {}
        await context.close();
      },
    };
  } catch (err) {
    stats.errors.push(`${label}: ${err.message}`);
    console.error(`${label} FAILED: ${err.message}`);
    return { label, cleanup: async () => {} };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nSpeakAI Browser Load Test`);
  console.log(`  Server:       ${SERVER_URL}`);
  console.log(`  Room:         ${ROOM_INVITE_CODE}`);
  console.log(`  Users:        ${NUM_USERS}`);
  console.log(`  Stagger:      ${STAGGER_MS}ms`);
  console.log(`  Duration:     ${DURATION_S}s`);
  console.log(`  Headless:     ${HEADLESS}`);
  console.log(`  Enable media: ${ENABLE_MEDIA}\n`);

  // Launch a single browser instance and share it (uses less memory than N browsers)
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--use-fake-ui-for-media-stream',      // auto-grant camera/mic permissions
      '--use-fake-device-for-media-stream',   // use fake camera/mic (no real hardware needed)
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',              // prevent /dev/shm running out in Docker
    ],
  });

  console.log('Browser launched\n');

  // Launch users with stagger
  const users = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const user = await launchUser(i, browser);
    users.push(user);

    if (i < NUM_USERS - 1) {
      await sleep(STAGGER_MS);
    }
  }

  printStats();

  // Hold connections
  console.log(`Holding ${stats.joinedRoom} connections for ${DURATION_S}s... (Ctrl+C to stop early)\n`);

  const statsInterval = setInterval(printStats, 15000);

  // Monitor memory usage
  const memInterval = setInterval(() => {
    const mem = process.memoryUsage();
    console.log(
      `[Memory] RSS: ${(mem.rss / 1024 / 1024).toFixed(0)}MB | ` +
      `Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(0)}/${(mem.heapTotal / 1024 / 1024).toFixed(0)}MB`
    );
  }, 10000);

  await sleep(DURATION_S * 1000);

  clearInterval(statsInterval);
  clearInterval(memInterval);

  // Cleanup
  console.log('\nDisconnecting all users...');
  for (const user of users) {
    await user.cleanup();
  }

  await browser.close();

  printStats();
  console.log('Done.');
  process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\nInterrupted — cleaning up...');
  printStats();
  process.exit(0);
});

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
