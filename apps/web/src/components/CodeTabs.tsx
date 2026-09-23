"use client";

import { useState } from "react";

type Example = {
  code: string;
  label: string;
};

export function CodeTabs({ examples }: { examples: Example[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const active = examples[activeIndex] ?? examples[0];

  if (!active) return null;

  async function copyCode() {
    await navigator.clipboard.writeText(active.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="code-window">
      <div className="code-toolbar">
        <div aria-label="Code examples" className="code-tabs" role="tablist">
          {examples.map((example, index) => (
            <button
              aria-controls={`code-panel-${index}`}
              aria-selected={activeIndex === index}
              className="code-tab"
              id={`code-tab-${index}`}
              key={example.label}
              onClick={() => {
                setActiveIndex(index);
                setCopied(false);
              }}
              role="tab"
              type="button"
            >
              {example.label}
            </button>
          ))}
        </div>
        <button className="copy-button" onClick={copyCode} type="button">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        aria-labelledby={`code-tab-${activeIndex}`}
        className="code-panel"
        id={`code-panel-${activeIndex}`}
        role="tabpanel"
      >
        <pre>
          <code>{active.code}</code>
        </pre>
      </div>
    </div>
  );
}
