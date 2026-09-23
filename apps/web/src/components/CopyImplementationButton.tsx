"use client";

import { CheckCircleIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

const implementationPrompt = `Install @dqnamo/voicecontrol using this project's package manager, then integrate voice control into the existing app.

Use VoiceControlProvider to configure transcription and point decideEndpoint to a server-side route. In that route, call Jev using the project's preferred setup, such as AI SDK with AI Gateway or raw HTTP. Keep credentials on the server.

Wrap the most useful existing controls with VoiceAction. Give every action a stable id, a clear description of when it should run, and its existing callback. Preserve the current UI, behavior, types, and accessibility.

Follow the project's existing conventions, run its checks, and summarize the files you changed.`;

export function CopyImplementationButton() {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyPrompt() {
    await navigator.clipboard.writeText(implementationPrompt);
    setCopied(true);

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2400);
  }

  return (
    <button
      aria-label={
        copied ? "Implementation prompt copied" : "Copy implementation prompt"
      }
      className="implementation-prompt-button"
      data-copied={copied ? "true" : undefined}
      onClick={() => void copyPrompt()}
      type="button"
    >
      <code>implement_voice_control.md</code>
      <span aria-hidden="true" className="copy-icon-shell">
        <CopyIcon
          className="copy-icon copy-icon-default"
          size={14}
          weight="bold"
        />
        <CheckCircleIcon
          className="copy-icon copy-icon-success"
          size={14}
          weight="fill"
        />
      </span>
      <span aria-live="polite" className="sr-only copy-feedback">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
