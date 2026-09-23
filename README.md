# VoiceControl

A small pnpm monorepo for the published `@dqnamo/voicecontrol` React SDK and its public website.

## Workspace

- `packages/voicecontrol` — headless React voice-control primitives
- `apps/web` — Astro + React homepage and documentation

## Development

```sh
pnpm install
cp apps/web/.env.example apps/web/.env
# Add your Inworld API key to apps/web/.env
pnpm test
pnpm build
pnpm dev
```

The website piano demo sends 16 kHz mono audio to a private server route backed by Inworld
STT. `INWORLD_API_KEY` is only read on the server and is never exposed to the browser.

The SDK remains version `0.0.1`. Publishing is intentionally not part of the root scripts.
