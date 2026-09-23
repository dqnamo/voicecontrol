import { codeToHtml } from "shiki";
import {
  CodeWalkthrough,
  walkthroughSteps,
} from "../src/components/CodeWalkthrough";
import { CopyImplementationButton } from "../src/components/CopyImplementationButton";
import { GitHubMark, ProcessArrow } from "../src/components/PageIcons";
import { PianoDemo } from "../src/components/PianoDemo";

export const dynamic = "force-static";

const heroExample = `import { VoiceAction } from "@dqnamo/voicecontrol";

<VoiceAction
  id="report.export"
  description="Export report as CSV"
  onVoiceAction={() => exportReport("csv")}
>
  <button>Export CSV</button>
</VoiceAction>`;

export default async function Home() {
  const [highlightedHero, ...highlightedSteps] = await Promise.all([
    codeToHtml(heroExample, { lang: "tsx", theme: "github-light" }),
    ...walkthroughSteps.map(({ code }) =>
      codeToHtml(code, { lang: "tsx", theme: "github-light" }),
    ),
  ]);

  return (
    <>
      <header className="site-header">
        <div className="brand brand-lockup">
          <a
            aria-label="Dqnamo website"
            className="brand-wordmark"
            href="https://dqnamo.com"
          >
            dqnamo
          </a>
          <a className="brand-product" href="#top">
            /voicecontrol
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero section-shell">
          <div className="hero-copy">
            <h1>Add super fast voice control to your app.</h1>
            <p className="hero-lede">
              Composable primitives that turn spoken intent into your existing
              React actions. VoiceControl builds the Jev decision; you choose
              how and where Jev runs.
            </p>
            <div className="hero-actions">
              <CopyImplementationButton />
              <a
                className="button hero-github"
                href="https://github.com/dqnamo/voicecontrol"
                rel="noreferrer"
                target="_blank"
              >
                <GitHubMark />
                GitHub
              </a>
            </div>
          </div>

          <aside aria-label="VoiceAction code example" className="hero-code">
            <div dangerouslySetInnerHTML={{ __html: highlightedHero }} />
          </aside>
        </section>

        <section
          aria-label="How VoiceControl works"
          className="principles-strip"
        >
          <div>
            <span>01</span>
            <strong>Define actions</strong>
            <small>Describe the actions already on your page.</small>
          </div>
          <ProcessArrow />
          <div>
            <span>02</span>
            <strong>Transcribe speech</strong>
            <small>Turn the user’s voice into text.</small>
          </div>
          <ProcessArrow />
          <div>
            <span>03</span>
            <strong>Let Jev decide</strong>
            <small>Jev chooses the matching action to run.</small>
          </div>
          <figure
            aria-label="Illustrative latency: prepare actions under 1 millisecond, transcribe speech 520 milliseconds, Jev decision 140 milliseconds"
            className="process-latency"
          >
            <div aria-hidden="true" className="process-latency-bar">
              <span />
              <span />
              <span />
            </div>
            <figcaption>
              <span>Illustrative latency</span>
              <span>
                <i />
                Prepare · &lt;1 ms
              </span>
              <span>
                <i />
                Transcribe · 520 ms
              </span>
              <span>
                <i />
                Decide · 140 ms
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="demo-section section-shell" id="demo">
          <PianoDemo />
        </section>

        <section className="walkthrough-section section-shell" id="quickstart">
          <CodeWalkthrough highlightedSteps={highlightedSteps} />
        </section>
      </main>
    </>
  );
}
