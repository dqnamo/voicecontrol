import {
  VoiceAction,
  VoiceControlProvider,
  createJevDecisionRequest,
  readJevVoiceDecision,
  useVoiceControl,
  type DecideInput,
  type JevBooleanAnswer,
  type TranscribeInput,
  type VoiceDecisionResult,
} from "@dqnamo/voicecontrol";
import { useCallback, useEffect, useRef, useState } from "react";

type NoteId =
  | "C4"
  | "C#4"
  | "D4"
  | "D#4"
  | "E4"
  | "F4"
  | "F#4"
  | "G4"
  | "G#4"
  | "A4"
  | "A#4"
  | "B4"
  | "C5";

type PianoKey = {
  computerKey: string;
  frequency: number;
  id: NoteId;
  label: string;
};

type PianoAction = {
  description: string;
  id: string;
  notes: NoteId[];
};

type RecordingSession = {
  chunks: Float32Array[];
  context: AudioContext;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
};

type JevOutput = {
  model: string;
  probabilities: Array<{ action: string; score: number }>;
  selected: Array<{ action: string; score: number }>;
  transcript: string;
  usage: { input_tokens: number; output_tokens: number } | null;
};

type JevServerResponse = {
  answers?: Record<string, JevBooleanAnswer>;
  error?: string;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
};

const WHITE_KEYS: PianoKey[] = [
  { computerKey: "A", frequency: 261.63, id: "C4", label: "C" },
  { computerKey: "S", frequency: 293.66, id: "D4", label: "D" },
  { computerKey: "D", frequency: 329.63, id: "E4", label: "E" },
  { computerKey: "F", frequency: 349.23, id: "F4", label: "F" },
  { computerKey: "G", frequency: 392, id: "G4", label: "G" },
  { computerKey: "H", frequency: 440, id: "A4", label: "A" },
  { computerKey: "J", frequency: 493.88, id: "B4", label: "B" },
  { computerKey: "K", frequency: 523.25, id: "C5", label: "C" },
];

const BLACK_KEYS: Array<PianoKey & { left: string }> = [
  { computerKey: "W", frequency: 277.18, id: "C#4", label: "C♯", left: "9%" },
  { computerKey: "E", frequency: 311.13, id: "D#4", label: "D♯", left: "21.5%" },
  { computerKey: "T", frequency: 369.99, id: "F#4", label: "F♯", left: "46.5%" },
  { computerKey: "Y", frequency: 415.3, id: "G#4", label: "G♯", left: "59%" },
  { computerKey: "U", frequency: 466.16, id: "A#4", label: "A♯", left: "71.5%" },
];

const ALL_KEYS = [...WHITE_KEYS, ...BLACK_KEYS];
const KEYS_BY_ID = new Map(ALL_KEYS.map((key) => [key.id, key]));
const KEYS_BY_COMPUTER_KEY = new Map(
  ALL_KEYS.map((key) => [key.computerKey.toLowerCase(), key.id]),
);

const CHORD_MEMBERSHIPS: Partial<Record<NoteId, string[]>> = {
  C4: ["C major"],
  D4: ["D minor"],
  E4: ["C major", "A minor"],
  F4: ["D minor"],
  G4: ["C major"],
  A4: ["D minor", "A minor"],
  C5: ["A minor"],
};

function noteActionId(note: NoteId) {
  return `piano.note.${note.toLowerCase().replace("#", "-sharp-")}`;
}

function noteActionDescription(key: PianoKey) {
  const chords = CHORD_MEMBERSHIPS[key.id];
  return [
    `Play the single piano note ${key.label} (${key.id}).`,
    chords
      ? `Also play it when the request names one of these chords: ${chords.join(", ")}.`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

const NOTE_ACTIONS: PianoAction[] = ALL_KEYS.map((key) => ({
  description: noteActionDescription(key),
  id: noteActionId(key.id),
  notes: [key.id],
}));

const ALL_ACTIONS = NOTE_ACTIONS;
const ACTIONS_BY_ID = new Map(ALL_ACTIONS.map((action) => [action.id, action]));

function displayNotes(notes: NoteId[]) {
  return notes.map((note) => KEYS_BY_ID.get(note)?.label ?? note).join(" · ");
}

function encodeLinear16(chunks: Float32Array[], inputSampleRate: number) {
  const inputLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const input = new Float32Array(inputLength);
  let inputOffset = 0;
  for (const chunk of chunks) {
    input.set(chunk, inputOffset);
    inputOffset += chunk.length;
  }

  const outputSampleRate = 16_000;
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / sampleRateRatio));
  const pcm = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * sampleRateRatio;
    const lowerIndex = Math.floor(sourcePosition);
    const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
    const mix = sourcePosition - lowerIndex;
    const sample = input[lowerIndex] * (1 - mix) + input[upperIndex] * mix;
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return new Blob([pcm.buffer], { type: "application/octet-stream" });
}

function stopRecordingSession(session: RecordingSession) {
  session.processor.onaudioprocess = null;
  session.source.disconnect();
  session.processor.disconnect();
  session.silentGain.disconnect();
  session.stream.getTracks().forEach((track) => track.stop());
}

async function transcribeAudio({ audio, signal }: TranscribeInput) {
  const formData = new FormData();
  formData.set("audio", audio, "voice-command.pcm");
  const response = await fetch("/api/transcribe", {
    body: formData,
    method: "POST",
    signal,
  });
  const result = (await response.json()) as { error?: string; transcript?: string };
  if (!response.ok) throw new Error(result.error ?? "Transcription failed.");
  return { transcript: result.transcript ?? "" };
}

export function PianoDemo() {
  const [jevOutput, setJevOutput] = useState<JevOutput | null>(null);

  const decide = useCallback(async (input: DecideInput): Promise<VoiceDecisionResult> => {
    const response = await fetch("/api/voice/decide", {
      body: JSON.stringify(
        createJevDecisionRequest(input, {
          instrument: "One-octave piano from C4 to C5",
          interpretation:
            "Commands request individual notes or chords. A named chord means its notes should play together. Scales are not supported.",
        }),
      ),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: input.signal,
    });
    const result = (await response.json()) as JevServerResponse;
    if (!response.ok) throw new Error(result.error ?? "Jev could not make a decision.");

    const answers = result.answers;
    if (!answers) throw new Error("Jev returned no action answers.");
    const decision = readJevVoiceDecision(
      result,
      input.selectionMode,
      input.multipleActionThreshold,
    );
    const selected = decision
      ? Array.isArray(decision)
        ? decision
        : [decision]
      : [];

    setJevOutput({
      model: result.model ?? "jev-latest",
      probabilities: Object.entries(answers)
        .map(([action, answer]) => ({ action, score: answer.probability }))
        .sort((a, b) => b.score - a.score),
      selected: selected.map(({ actionId, probability }) => ({
        action: actionId,
        score: probability,
      })),
      transcript: input.transcript,
      usage: result.usage ?? null,
    });

    return decision;
  }, []);

  return (
    <VoiceControlProvider
      decide={decide}
      selectionMode="multiple"
      transcribe={transcribeAudio}
    >
      <PianoDemoContent jevOutput={jevOutput} />
    </VoiceControlProvider>
  );
}

function PianoDemoContent({ jevOutput }: { jevOutput: JevOutput | null }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingRef = useRef<RecordingSession | null>(null);
  const timersRef = useRef(new Set<number>());
  const {
    error,
    status: voiceStatus,
    submitAudio,
    submitTranscript,
    transcript,
  } = useVoiceControl();
  const [activeNotes, setActiveNotes] = useState<Set<NoteId>>(new Set());
  const [command, setCommand] = useState("play C major");
  const [isStarting, setIsStarting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [message, setMessage] = useState("Ready — press “Play command”");

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
  }, []);

  const playNote = useCallback(
    (noteId: NoteId) => {
      const key = KEYS_BY_ID.get(noteId);
      if (!key) return;

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        setMessage("Web Audio is not supported in this browser.");
        return;
      }

      const context = audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(key.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.24, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.7);

      setActiveNotes((current) => new Set(current).add(noteId));
      schedule(() => {
        setActiveNotes((current) => {
          const next = new Set(current);
          next.delete(noteId);
          return next;
        });
      }, 700);
    },
    [schedule],
  );

  useEffect(() => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    setSpeechSupported(Boolean(navigator.mediaDevices && AudioContextConstructor));

    return () => {
      const recording = recordingRef.current;
      if (recording) {
        stopRecordingSession(recording);
        void recording.context.close();
      }
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']") || event.repeat) return;
      const note = KEYS_BY_COMPUTER_KEY.get(event.key.toLowerCase());
      if (!note) return;
      event.preventDefault();
      playNote(note);
      setMessage(`Playing ${KEYS_BY_ID.get(note)?.label ?? note}`);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playNote]);

  useEffect(() => {
    if (!jevOutput) return;
    const notes = jevOutput.selected.flatMap(
      ({ action }) => ACTIONS_BY_ID.get(action)?.notes ?? [],
    );
    setMessage(
      notes.length > 0
        ? `Playing ${displayNotes(notes)}`
        : "Jev found no matching piano action.",
    );
  }, [jevOutput]);

  useEffect(() => {
    if (transcript) setCommand(transcript);
  }, [transcript]);

  async function sendCommand(nextCommand: string) {
    setMessage("Sending command to Jev…");
    await submitTranscript(nextCommand);
  }

  async function finishRecording() {
    const recording = recordingRef.current;
    if (!recording) return;

    recordingRef.current = null;
    setIsListening(false);
    stopRecordingSession(recording);
    const inputSampleRate = recording.context.sampleRate;
    await recording.context.close();

    if (recording.chunks.length === 0) {
      setMessage("I couldn’t hear that. Try again or type a command.");
      return;
    }

    setMessage("Transcribing with Inworld…");

    try {
      const audio = encodeLinear16(recording.chunks, inputSampleRate);
      await submitAudio(audio);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : "Transcription failed. Try again.");
    }
  }

  async function toggleListening() {
    if (isListening) {
      await finishRecording();
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContextConstructor) {
      setSpeechSupported(false);
      setMessage("Voice commands are unavailable here — type a command instead.");
      return;
    }

    setIsStarting(true);
    setMessage("Requesting microphone access…");

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      context = new AudioContextConstructor();
      if (context.state === "suspended") await context.resume();

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      const chunks: Float32Array[] = [];
      silentGain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      recordingRef.current = { chunks, context, processor, silentGain, source, stream };
      setIsListening(true);
      setMessage("Listening…");
    } catch (nextError) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") void context.close();
      setMessage(
        nextError instanceof DOMException && nextError.name === "NotAllowedError"
          ? "Microphone access was blocked — type a command instead."
          : "I couldn’t start the microphone. Try again or type a command.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  const isTranscribing = voiceStatus === "transcribing";
  const isDeciding = voiceStatus === "deciding" || voiceStatus === "executing";
  const visibleMessage =
    error?.message ??
    (voiceStatus === "deciding" ? "Jev is deciding…" : voiceStatus === "executing" ? "Running action…" : message);
  const selectedNotes =
    jevOutput?.selected.flatMap(
      ({ action }) => ACTIONS_BY_ID.get(action)?.notes ?? [],
    ) ?? [];

  return (
    <div className="piano-demo-layout">
      <div className="piano-demo">
        <div className="piano-demo-controls">
          <div aria-busy={isStarting || isTranscribing || isDeciding} aria-live="polite" className="piano-demo-status">
            <span className={isListening || isDeciding ? "is-listening" : ""} aria-hidden="true" />
            <div>
              <small>{isListening || isTranscribing ? "INWORLD STT" : "VOICECONTROL · JEV"}</small>
              <strong>{visibleMessage}</strong>
            </div>
          </div>

          <button
            aria-pressed={isListening}
            className="voice-trigger"
            disabled={!speechSupported || isStarting || isTranscribing || isDeciding}
            onClick={() => void toggleListening()}
            type="button"
          >
            {isStarting
              ? "Starting microphone…"
              : isTranscribing
                ? "Transcribing…"
                : isListening
                  ? "Stop listening"
                  : "Talk to the piano"}
          </button>
        </div>

        <form
          className="piano-command-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (command.trim()) void sendCommand(command.trim());
          }}
        >
          <label htmlFor="piano-command">Voice command</label>
          <input
            id="piano-command"
            onChange={(event) => setCommand(event.target.value)}
            placeholder="play C major"
            type="text"
            value={command}
          />
          <button disabled={isDeciding} type="submit">Play command</button>
        </form>

        <div className="piano-scroll">
          <div aria-label="Interactive piano" className="piano-board">
            <div className="piano-white-keys">
              {WHITE_KEYS.map((key) => (
                <VoiceAction
                  asChild
                  description={noteActionDescription(key)}
                  id={noteActionId(key.id)}
                  key={key.id}
                  onVoiceAction={() => playNote(key.id)}
                >
                  <button
                    aria-label={`Play ${key.label}`}
                    className={`piano-key piano-key-white${activeNotes.has(key.id) ? " is-active" : ""}`}
                    onClick={() => {
                      playNote(key.id);
                      setMessage(`Playing ${key.label}`);
                    }}
                    type="button"
                  >
                    <span>{key.label}</span>
                    <kbd>{key.computerKey}</kbd>
                  </button>
                </VoiceAction>
              ))}
            </div>

            {BLACK_KEYS.map((key) => (
              <VoiceAction
                asChild
                description={noteActionDescription(key)}
                id={noteActionId(key.id)}
                key={key.id}
                onVoiceAction={() => playNote(key.id)}
              >
                <button
                  aria-label={`Play ${key.label}`}
                  className={`piano-key piano-key-black${activeNotes.has(key.id) ? " is-active" : ""}`}
                  onClick={() => {
                    playNote(key.id);
                    setMessage(`Playing ${key.label}`);
                  }}
                  style={{ left: key.left }}
                  type="button"
                >
                  <span>{key.label}</span>
                  <kbd>{key.computerKey}</kbd>
                </button>
              </VoiceAction>
            ))}
          </div>
        </div>

        <p className="piano-demo-help">
          Click the keys or use <kbd>A–K</kbd>. Voice examples: “play F sharp” or “play D
          minor”.
        </p>
      </div>

      <aside aria-live="polite" className="jev-output-card">
        <div className="jev-output-header">
          <div>
            <span>JEV</span>
            <h3>Decision output</h3>
          </div>
          <span className="jev-output-badge">Live</span>
        </div>

        {jevOutput ? (
          <>
            <div className="jev-output-transcript">
              <span>Transcript</span>
              <q>{jevOutput.transcript}</q>
            </div>

            <div className="jev-output-choice">
              <span>Selected actions</span>
              <code>
                {jevOutput.selected.length > 0
                  ? jevOutput.selected
                      .map(({ action }) => action.replace("piano.note.", ""))
                      .join(" + ")
                  : "No match"}
              </code>
              <strong>{jevOutput.selected.length}</strong>
            </div>

            <div className="jev-output-scores">
              <span>Top action scores</span>
              <ol>
                {jevOutput.probabilities.slice(0, 5).map(({ action, score }) => (
                  <li key={action}>
                    <div>
                      <code>{action.replace("piano.", "")}</code>
                      <span>{Math.round(score * 100)}%</span>
                    </div>
                    <span aria-hidden="true">
                      <i style={{ width: `${score * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="jev-output-payload">
              <span>Executed payload</span>
              <code>
                {selectedNotes.length > 0
                  ? `notes: [${selectedNotes.map((note) => `"${note}"`).join(", ")}]`
                  : "No action executed"}
              </code>
              <small>
                {jevOutput.model}
                {jevOutput.usage
                  ? ` · ${jevOutput.usage.input_tokens + jevOutput.usage.output_tokens} tokens`
                  : ""}
              </small>
            </div>
          </>
        ) : (
          <div className="jev-output-empty">
            <strong>Waiting for Jev</strong>
            <p>Run a voice or typed command to see the real model response and probabilities.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
