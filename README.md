# SpeakAI WebRTC + Live Translation

Multi-party WebRTC rooms with an optional server-side translation bot. When a listener picks a target language, the original speaker audio is muted for that listener and replaced by translated TTS audio.

## Features
- WebRTC mesh for participant media.
- Server “bot peer” (Node + `wrtc`) joins each room to ingest audio and publish translated tracks.
- Streaming pipeline: VAD/ASR (AWS Transcribe with language ID) → MT (Google Cloud Translation) → TTS (Azure Neural TTS, default `en-US-FableMultilingualNeural` in `eastus`).
- Replace-mode playback: translated track mutes the original for listeners who opt in.
- Per-room, per-listener language preference; pipelines spin up on demand and tear down after inactivity.
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

## Environment variables (sample names)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `GOOGLE_MT_KEY`
- `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `AZURE_TTS_VOICE`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` (auth/db)
- `NEXTAUTH_URL` (for production auth callbacks)

## How it works (high level)
- Browser peers connect via Socket.IO signaling.
- A server “translator-bot” peer attaches an audio sink to each speaker.
- Audio is downsampled to 16 kHz and streamed to Transcribe with language ID and fallback.
- Final transcripts feed Google MT; translated text goes to Azure TTS.
- PCM is chunked (10 ms) into an `RTCAudioSource`; the bot publishes translated tracks.
- Clients mute originals when a translated track is active in their chosen language.

## Notes
- No DB persistence for language choices; they are room-scoped.
- Pipelines are on-demand with a short grace period before teardown to save cost.
- If TTS lags, captions-only fallback is acceptable; audio resumes when ready.
