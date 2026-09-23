# @dqnamo/voicecontrol

Headless React primitives for adding voice commands to existing interfaces. VoiceControl turns registered actions into typed Jev questions while you keep control of transcription and the server-side Jev connection.

```tsx
import {
  VoiceAction,
  VoiceControlProvider,
  useVoiceControl,
} from "@dqnamo/voicecontrol";

<VoiceControlProvider
  transcribe={transcribe}
  decideEndpoint="/api/voice/decide"
>
  <VoiceAction
    asChild
    id="note.save"
    description="Save the current note"
    onVoiceAction={() => saveNote()}
  >
    <button>Save</button>
  </VoiceAction>
</VoiceControlProvider>;
```

The browser sends Jev-compatible `state` and `questions` to `decideEndpoint`. The route can call Jev through any supported transport. With AI SDK and Vercel AI Gateway:

```sh
pnpm add ai
```

```ts
import type { JevVoiceDecisionRequest } from "@dqnamo/voicecontrol";
import { experimental_evaluate as evaluate } from "ai";

export async function POST(request: Request) {
  const decision = (await request.json()) as JevVoiceDecisionRequest;
  const result = await evaluate({
    model: "typesafe-ai/jev",
    ...decision,
    providerOptions: {
      gateway: { zeroDataRetention: true },
    },
  });

  return Response.json({ answers: result.answers });
}
```

Set `AI_GATEWAY_API_KEY` on the server. Single-action selection is the default: the SDK asks one choice question, handles its built-in no-match option, and executes the winning React callback.

Use multiple-action selection when one command may intentionally trigger several registered actions:

```tsx
<VoiceControlProvider
  decideEndpoint="/api/voice/decide"
  selectionMode="multiple"
  transcribe={transcribe}
>
  {children}
</VoiceControlProvider>
```

Multiple mode asks one boolean question per action in a single Jev request and runs every action whose probability is above 50%. Use the `decide` prop instead of `decideEndpoint` when you need a completely custom decision adapter.

Set `multipleActionThreshold` when a domain needs different calibration. It accepts a probability from `0` to `1` and defaults to `0.5`.

The original `defineVoiceAction`, `voiceControlAttributes`, and `voiceControlAttributeNames` exports remain available for framework-agnostic use.
