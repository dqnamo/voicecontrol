import type { APIRoute } from "astro";

export const prerender = false;

const INWORLD_TRANSCRIBE_URL = "https://api.inworld.ai/stt/v1/transcribe";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.INWORLD_API_KEY;
  if (!apiKey) return json({ error: "Inworld STT is not configured yet." }, 503);

  let audio: FormDataEntryValue | null;
  try {
    audio = (await request.formData()).get("audio");
  } catch {
    return json({ error: "The audio upload could not be read." }, 400);
  }

  if (!(audio instanceof File) || audio.size === 0) {
    return json({ error: "A voice recording is required." }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return json({ error: "That recording is too long. Try a shorter command." }, 413);
  }

  try {
    const content = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const response = await fetch(INWORLD_TRANSCRIBE_URL, {
      body: JSON.stringify({
        audioData: { content },
        transcribeConfig: {
          audioEncoding: "LINEAR16",
          language: "en-US",
          modelId: "inworld/inworld-stt-1",
          numberOfChannels: 1,
          prompts: [
            "play C major",
            "play D minor",
            "play A minor",
            "play the scale",
            "C sharp",
            "D sharp",
            "F sharp",
            "G sharp",
            "A sharp",
          ],
          sampleRateHertz: 16_000,
        },
      }),
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    const result = (await response.json()) as {
      message?: string;
      transcription?: { transcript?: string };
    };
    if (!response.ok) {
      console.error("Inworld STT request failed", response.status, result);
      return json({ error: "Inworld could not transcribe that recording." }, 502);
    }

    return json({ transcript: result.transcription?.transcript ?? "" });
  } catch (error) {
    console.error("Inworld STT request failed", error);
    return json({ error: "Inworld could not transcribe that recording." }, 502);
  }
};
