import type { JevVoiceDecisionRequest } from "@dqnamo/voicecontrol";
import { createGateway, experimental_evaluate as evaluate } from "ai";
import type { APIRoute } from "astro";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.AI_GATEWAY_API_KEY;
  if (!apiKey) return json({ error: "AI Gateway is not configured yet." }, 503);

  let decision: JevVoiceDecisionRequest;
  try {
    decision = (await request.json()) as JevVoiceDecisionRequest;
  } catch {
    return json({ error: "The Jev decision request could not be read." }, 400);
  }

  try {
    const gateway = createGateway({ apiKey });
    const result = await evaluate({
      abortSignal: request.signal,
      model: gateway.evaluation("typesafe-ai/jev"),
      providerOptions: {
        gateway: {
          zeroDataRetention: true,
        },
      },
      questions: decision.questions,
      state: decision.state,
    });
    return json({
      answers: result.answers,
      model: result.response.modelId,
      usage: {
        input_tokens: result.usage.inputTokens ?? 0,
        output_tokens: result.usage.outputTokens ?? 0,
      },
    });
  } catch (error) {
    console.error("AI Gateway Jev request failed", error);
    return json({ error: "Jev could not decide which piano action to run." }, 502);
  }
};
