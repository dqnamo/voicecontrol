import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  VoiceAction,
  VoiceControlProvider,
  createJevDecisionAdapter,
  createJevDecisionRequest,
  defineVoiceAction,
  useVoiceControl,
  voiceControlNoMatchActionId,
  voiceControlAttributeNames,
  voiceControlAttributes,
} from "../src/index";

function TranscriptSubmitter() {
  const { submitTranscript } = useVoiceControl();
  return (
    <button onClick={() => void submitTranscript("save this note")} type="button">
      Submit transcript
    </button>
  );
}

const adapters = {
  decide: vi.fn(async () => null),
  transcribe: vi.fn(async () => ""),
};

describe("framework-agnostic helpers", () => {
  it("defines, trims and freezes a voice action", () => {
    const action = defineVoiceAction({
      description: " Complete the task ",
      execute() {},
      id: " task.complete ",
    });

    expect(action.id).toBe("task.complete");
    expect(action.description).toBe("Complete the task");
    expect(Object.isFrozen(action)).toBe(true);
  });

  it("creates inspectable data attributes", () => {
    expect(
      voiceControlAttributes({
        confirmation: true,
        description: "Delete the task",
        id: "task.delete",
      }),
    ).toEqual({
      "data-voice-control-confirm": "true",
      "data-voice-control-desc": "Delete the task",
      "data-voice-control-id": "task.delete",
    });
    expect(voiceControlAttributeNames.id).toBe("data-voice-control-id");
  });
});

describe("VoiceAction", () => {
  it("adds metadata to its own button", () => {
    render(
      <VoiceControlProvider {...adapters}>
        <VoiceAction
          description="Save the current note"
          id="note.save"
          onVoiceAction={() => undefined}
        >
          Save
        </VoiceAction>
      </VoiceControlProvider>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-voice-control-id",
      "note.save",
    );
  });

  it("composes with an existing element through asChild", () => {
    render(
      <VoiceControlProvider {...adapters}>
        <VoiceAction
          asChild
          description="Open settings"
          id="settings.open"
          kind="navigation"
          onVoiceAction={() => undefined}
        >
          <a href="/settings">Settings</a>
        </VoiceAction>
      </VoiceControlProvider>,
    );

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "data-voice-control-desc",
      "Open settings",
    );
  });

  it("runs a typed transcript through the registered SDK actions", async () => {
    const decide = vi.fn(async () => ({ actionId: "note.save", probability: 0.93 }));
    const onVoiceAction = vi.fn();
    const transcribe = vi.fn(async () => "");

    render(
      <VoiceControlProvider decide={decide} transcribe={transcribe}>
        <TranscriptSubmitter />
        <VoiceAction
          description="Save the current note"
          id="note.save"
          onVoiceAction={onVoiceAction}
        >
          Save
        </VoiceAction>
      </VoiceControlProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit transcript" }));

    await waitFor(() => expect(onVoiceAction).toHaveBeenCalledOnce());
    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [expect.objectContaining({ id: "note.save" })],
        transcript: "save this note",
      }),
    );
    expect(onVoiceAction).toHaveBeenCalledWith(
      expect.objectContaining({ probability: 0.93, transcript: "save this note" }),
    );
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("runs every selected action in multiple mode", async () => {
    const decide = vi.fn(async () => [
      { actionId: "note.c", probability: 0.94 },
      { actionId: "note.e", probability: 0.91 },
    ]);
    const playC = vi.fn();
    const playE = vi.fn();

    const view = render(
      <VoiceControlProvider
        decide={decide}
        selectionMode="multiple"
        transcribe={async () => ""}
      >
        <TranscriptSubmitter />
        <VoiceAction description="Play C" id="note.c" onVoiceAction={playC}>
          C
        </VoiceAction>
        <VoiceAction description="Play E" id="note.e" onVoiceAction={playE}>
          E
        </VoiceAction>
      </VoiceControlProvider>,
    );

    fireEvent.click(
      within(view.container).getByRole("button", { name: "Submit transcript" }),
    );

    await waitFor(() => expect(playC).toHaveBeenCalledOnce());
    expect(playE).toHaveBeenCalledOnce();
    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({ selectionMode: "multiple" }),
    );
  });
});

describe("Jev decision adapter", () => {
  const input = {
    actions: [
      {
        description: "Save the current note",
        id: "note.save",
        kind: "action" as const,
      },
    ],
    multipleActionThreshold: 0.5,
    selectionMode: "single" as const,
    signal: new AbortController().signal,
    transcript: "save this note",
  };

  it("builds a typed Jev choice request", () => {
    const request = createJevDecisionRequest(input, { route: "/notes/42" });

    expect(request.state).toEqual({
      context: { route: "/notes/42" },
      transcript: "save this note",
    });
    expect(request.questions.voiceAction.criteria).toMatchObject({
      [voiceControlNoMatchActionId]: expect.any(String),
      "note.save": "Save the current note Kind: action.",
    });
  });

  it("posts the Jev request and reads its typed choice", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          answers: {
            voiceAction: {
              choice: "note.save",
              probabilities: { "note.save": 0.96 },
            },
          },
        }),
      ),
    );
    const decide = createJevDecisionAdapter("/api/voice/decide", {
      fetch: fetcher,
    });

    await expect(decide(input)).resolves.toEqual({
      actionId: "note.save",
      probability: 0.96,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/voice/decide",
      expect.objectContaining({ method: "POST", signal: input.signal }),
    );
  });

  it("builds boolean questions and returns every positive action in multiple mode", async () => {
    const multipleInput = {
      ...input,
      actions: [
        input.actions[0]!,
        { description: "Archive the current note", id: "note.archive" },
      ],
      selectionMode: "multiple" as const,
    };
    const request = createJevDecisionRequest(multipleInput);

    expect(request.questions["note.save"]).toMatchObject({
      type: "boolean",
    });
    expect(request.questions["note.archive"]).toMatchObject({
      type: "boolean",
    });

    const decide = createJevDecisionAdapter("/api/voice/decide", {
      fetch: async () =>
        new Response(
          JSON.stringify({
            answers: {
              "note.archive": { probability: 0.21, type: "boolean" },
              "note.save": { probability: 0.92, type: "boolean" },
            },
          }),
        ),
    });

    await expect(decide(multipleInput)).resolves.toEqual([
      { actionId: "note.save", probability: 0.92 },
    ]);
  });

  it("turns Jev's no-match choice into no decision", async () => {
    const decide = createJevDecisionAdapter("/api/voice/decide", {
      fetch: async () =>
        new Response(
          JSON.stringify({
            answers: {
              voiceAction: {
                choice: voiceControlNoMatchActionId,
                probabilities: { [voiceControlNoMatchActionId]: 0.91 },
              },
            },
          }),
        ),
    });

    await expect(decide(input)).resolves.toBeNull();
  });
});
