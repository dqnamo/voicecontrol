export type WalkthroughStep = {
  code: string;
  description: string;
  file: string;
  title: string;
};

export const walkthroughSteps: WalkthroughStep[] = [
  {
    file: "App.tsx",
    title: "Connect the voice runtime.",
    description:
      "Wrap your app once. You bring the transcription function and keep your model endpoint on the server.",
    code: `import { VoiceControlProvider } from "@dqnamo/voicecontrol";

async function transcribe({ audio, signal }) {
  const body = new FormData();
  body.append("audio", audio);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body,
    signal,
  });

  return response.json();
}

export function App() {
  return (
    <VoiceControlProvider
      transcribe={transcribe}
      decideEndpoint="/api/voice/decide"
    >
      <TodoList />
    </VoiceControlProvider>
  );
}`,
  },
  {
    file: "TodoList.tsx",
    title: "Make “add a todo” speakable.",
    description:
      "Wrap the todo form with one VoiceAction. It keeps the same submit function and the same interface.",
    code: `import { VoiceAction } from "@dqnamo/voicecontrol";

export function TodoList() {
  return (
    <VoiceAction
      asChild
      id="todo.add"
      description="Add a new todo item"
      onVoiceAction={({ text }) => addTodo(text)}
    >
      <form onSubmit={handleSubmit}>
        <input placeholder="Add a todo" />
        <button>Add</button>
      </form>
    </VoiceAction>
  );
}`,
  },
  {
    file: "api/voice/decide.ts",
    title: "Let Jev choose the match.",
    description:
      "Send the typed decision to Jev from a server route. Credentials and provider choices never reach the browser.",
    code: `import { experimental_evaluate as evaluate } from "ai";
import type { JevVoiceDecisionRequest } from "@dqnamo/voicecontrol";

export async function POST(request: Request) {
  const decision =
    (await request.json()) as JevVoiceDecisionRequest;

  const result = await evaluate({
    model: "typesafe-ai/jev",
    ...decision,
  });

  return Response.json({
    answers: {
      voiceAction: result.answers.voiceAction,
    },
  });
}`,
  },
  {
    file: "App.tsx",
    title: "That’s the whole integration.",
    description:
      "Say “add buy milk” and the same addTodo function your form already uses runs with the spoken task.",
    code: `export function App() {
  return (
    <VoiceControlProvider
      transcribe={transcribe}
      decideEndpoint="/api/voice/decide"
    >
      <TodoList />
    </VoiceControlProvider>
  );
}

// Speak: “Add buy milk to my todo list”
// VoiceControl runs addTodo("buy milk")`,
  },
];

type CodeWalkthroughProps = {
  highlightedSteps: string[];
};

export function CodeWalkthrough({ highlightedSteps }: CodeWalkthroughProps) {
  return (
    <div className="code-guide">
      {walkthroughSteps.map((step, index) => (
        <article className="code-guide-section" key={step.title}>
          <div className="code-guide-copy">
            <h2>{step.title}</h2>
            <p>{step.description}</p>
          </div>

          <div className="code-guide-card">
            <div className="code-guide-file">{step.file}</div>
            <div
              className="code-guide-code"
              dangerouslySetInnerHTML={{ __html: highlightedSteps[index] }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
