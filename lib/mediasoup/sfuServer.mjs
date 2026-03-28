import mediasoup from 'mediasoup';
import os from 'os';

const NUM_WORKERS = Math.min(os.cpus().length, 4);

/** @type {import('mediasoup').types.Worker[]} */
const workers = [];
let workerIndex = 0;

/** @type {Map<string, import('mediasoup').types.Router>} */
const routers = new Map();

/** Deduplication cache: prevents two concurrent calls from creating two routers for the same room. */
const routerCreating = new Map(); // roomId -> Promise<Router>

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
  },
];

export const webRtcTransportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
};

/**
 * Spawn mediasoup workers. Must be called once at server startup.
 */
export async function init() {
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });
    worker.on('died', err => {
      console.error(`mediasoup worker ${worker.pid} died:`, err);
      // Remove dead worker and spawn a replacement
      const idx = workers.indexOf(worker);
      if (idx !== -1) workers.splice(idx, 1);
      mediasoup
        .createWorker({ logLevel: 'warn', rtcMinPort: 40000, rtcMaxPort: 49999 })
        .then(w => {
          w.on('died', () => {});
          workers.push(w);
        })
        .catch(() => {});
    });
    workers.push(worker);
  }
  console.log(`mediasoup: spawned ${workers.length} workers`);
}

function getNextWorker() {
  const worker = workers[workerIndex % workers.length];
  workerIndex++;
  return worker;
}

/**
 * Get or create a mediasoup Router for the given room.
 * @param {string} roomId
 * @returns {Promise<import('mediasoup').types.Router>}
 */
export async function getOrCreateRouter(roomId) {
  if (routers.has(roomId)) return routers.get(roomId);
  if (routerCreating.has(roomId)) return routerCreating.get(roomId);
  const promise = (async () => {
    const worker = getNextWorker();
    const router = await worker.createRouter({ mediaCodecs });
    routers.set(roomId, router);
    routerCreating.delete(roomId);
    return router;
  })();
  routerCreating.set(roomId, promise);
  return promise;
}

/**
 * Close the Router for the given room and free resources.
 * @param {string} roomId
 */
export async function closeRouter(roomId) {
  const router = routers.get(roomId);
  if (!router) return;
  try {
    router.close();
  } catch {}
  routers.delete(roomId);
}

/**
 * Return the RTP capabilities of the router for the given room.
 * @param {string} roomId
 * @returns {import('mediasoup').types.RtpCapabilities | null}
 */
export function getRouterRtpCapabilities(roomId) {
  const router = routers.get(roomId);
  return router ? router.rtpCapabilities : null;
}
