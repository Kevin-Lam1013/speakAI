# SpeakAI: Real-Time WebRTC Translation Platform

Multi-party WebRTC rooms with a server-side translation bot that routes speech into each listener's preferred language. When a listener opts in, the original speaker audio is muted for that listener and replaced by low-latency translated TTS audio.

## Features
- Multi-party WebRTC mesh with authenticated Socket.IO signaling.
- Server "translator-bot" peer (Node + `wrtc`) joins each room to ingest audio and publish per-language tracks.
- Streaming pipeline: Voice Activity Detection/Automatic Speech Recognition (AWS Transcribe with language ID) -> Machine Translation (Google Cloud Translation) -> Text-To-Speech (Azure Neural TTS, default `en-US-FableMultilingualNeural` in `eastus`).
- Per-listener language routing with replace-mode playback (translated track mutes the original).
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

## Environment variables (sample names)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `GOOGLE_MT_KEY`
- `AZURE_TTS_KEY`, `AZURE_TTS_REGION`, `AZURE_TTS_VOICE`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` (auth/db)
- `NEXTAUTH_URL` (for production auth callbacks)

## How it works (high level)
- Browser peers connect via Socket.IO signaling and establish a WebRTC mesh.
- A server "translator-bot" peer attaches an audio sink to each speaker's inbound track.
- Audio is downsampled to 16 kHz and streamed to AWS Transcribe with language ID and a fixed-language fallback.
- Final transcripts are translated with Google MT; the translated text is synthesized by Azure TTS.
- PCM is chunked (10 ms) into an `RTCAudioSource`; the bot publishes per-language tracks to subscribers.
- Clients automatically mute originals when a translated track is active for their chosen language.

## Notes
- Language preferences are room-scoped and kept in memory (no DB persistence).
- Pipelines are created on demand and torn down after a short grace period to reduce cloud spend.
- If TTS lags, captions-only is acceptable until audio resumes.
