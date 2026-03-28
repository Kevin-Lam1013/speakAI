# SpeakAI: Real-Time Translation Platform

Multi-party video rooms with server-side real-time translation. When a listener opts in to a language, the original speaker audio is muted and replaced by low-latency TTS audio in their chosen language.

## Features
- Multi-party rooms via a mediasoup SFU (Selective Forwarding Unit) — scales well beyond the 4–6 user limit of a mesh topology.
- Streaming translation pipeline: AWS Transcribe (ASR with automatic language detection) → Google Cloud Translation (MT) → Azure Neural TTS.
- Per-listener language routing with replace-mode playback (translated track mutes the original as soon as a language is selected).
- Streaming Azure TTS — translated audio starts playing as the first PCM bytes arrive, reducing latency by 100–400ms per sentence.
- Real-time paced RTP output — TTS frames sent at 20ms intervals to match mediasoup's jitter buffer expectations.
- Translation cache — repeated phrases skip the Google MT HTTP call entirely.
- On-demand pipeline lifecycle with inactivity-based teardown for cost control.
- Supported targets: en-US, fr-FR, es-ES, zh-CN.

## Requirements
- Node.js LTS
- npm
- WebRTC-capable browser
- Cloud credentials: AWS Transcribe, Google Translation, Azure TTS

## Setup
1) Install deps:
```bash
npm install
```
2) Copy env template and fill with your keys:
```bash
cp .env.example .env.local
```
   - Keep secrets in env files; `.env*` is git-ignored except `.env.example`.
3) Run the app:
```bash
npm run dev
```
Open http://localhost:3000 and join/create a room.

## Environment variables
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — AWS Transcribe
- `GOOGLE_MT_KEY` — Google Cloud Translation
- `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `AZURE_TTS_VOICE` — Azure Neural TTS
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` — auth and database
- `ANNOUNCED_IP` — mediasoup ICE candidate IP (127.0.0.1 for local dev, public IP in production)

## How it works
- Each client connects to the mediasoup SFU via one send transport and one recv transport.
- The server ingests each speaker's audio via a PlainTransport consumer → UDP socket → opusscript decode → PCM.
- PCM is downsampled to 16 kHz and streamed to AWS Transcribe with automatic language detection (`IdentifyLanguage: true`, options: `en-US,fr-FR,es-ES,zh-CN`).
- Final transcripts are translated by Google MT (with in-memory cache) and synthesized by Azure Neural TTS.
- Azure TTS is consumed as a streaming response — RTP frames are sent at real-time pace (20ms intervals) as PCM chunks arrive.
- TTS PCM is encoded with opusscript and injected back into mediasoup as a new Producer per *(speaker × language)* pair.
- Listeners who select a language receive that TTS producer and original audio is muted immediately on selection.
- When a speaker turns off their camera or mic, the server is explicitly notified via `sfu:close-producer` so all other clients remove the consumer track cleanly.

## Translation audio flow
```
Speaker mic → mediasoup Producer → PlainTransport → UDP → opusscript decode
→ downsample 48kHz→16kHz → AWS Transcribe (auto language detect)
→ Google MT (cached) → Azure TTS (streamed) → opusscript encode
→ RTP (20ms paced) → mediasoup Producer → N Consumers → listeners
```

## Load testing
Two load test scripts are available in `scripts/`:

```bash
# Signaling-level test (Socket.IO + mediasoup transport allocation, no real media)
node scripts/load-test.mjs --users 50 --room <inviteCode>

# Full browser test (real WebRTC media via Playwright + Chromium)
node scripts/load-test-browser.mjs --users 20 --room <inviteCode>
node scripts/load-test-browser.mjs --users 20 --room <inviteCode> --enable-media
```

## Notes
- Language preferences are room-scoped and kept in memory (no DB persistence).
- Pipelines are created on demand and torn down after a 15-second grace period when no listeners remain.
- `ANNOUNCED_IP` must be the server's public IP in production for WebRTC ICE to work with remote clients.
- AWS Transcribe `LanguageOptions` must be a comma-separated string (not an array) for `IdentifyLanguage` to work correctly.
