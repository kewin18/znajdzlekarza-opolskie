export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse(null, 204, env);
    }

    if (url.pathname !== "/health-chat") {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "POST") {
      return corsResponse({ error: "Method not allowed" }, 405, env);
    }

    let body = null;
    try {
      body = await request.json();
    } catch {
      return corsResponse({ error: "Invalid JSON" }, 400, env);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return corsResponse({ error: "Missing messages" }, 400, env);
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      return corsResponse({ error: "OPENAI_API_KEY is not configured" }, 500, env);
    }

    // Model can be overridden with wrangler secret: OPENAI_MODEL
    const model = (env.OPENAI_MODEL && String(env.OPENAI_MODEL).trim()) || "gpt-4o-mini";

    const system = [
      "Jestes polskim asystentem zdrowotnym (triage) na stronie lokalnej wyszukiwarki lekarzy.",
      "Odpowiadasz WYLACZNIE na tematy zdrowotne, objawy, profilaktyke i gdzie zglosic sie po pomoc (POZ/NPL/SOR/112) oraz jakiego specjaliste szukac.",
      "Nie stawiaj diagnozy. Nie udzielaj instrukcji szkodliwych. W razie zagrozenia zycia zawsze kieruj na 112/SOR.",
      "Zasada rozmowy: najpierw dopytujesz (1-3 krotkie pytania) jesli brakuje danych. Dopiero gdy masz wystarczajaco informacji, ustaw done=true i daj decyzje pilnosci.",
      "Jesli sa czerwone flagi (duszność, bol w klatce, udarowe objawy, utrata przytomnosci, drgawki, silne krwawienie, krwawienie z odbytu z omdleniem) -> done=true, urgency=danger, next_step=112/SOR.",
      "Zawsze dodaj zdanie: To informacja, nie diagnoza lekarska."
    ].join("\n");

    // Keep only last N messages to control cost
    const trimmed = messages.slice(-16).map((m) => ({
      role: String(m.role || "user"),
      content: String(m.content || "")
    }));

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["reply", "done"],
      properties: {
        reply: { type: "string" },
        done: { type: "boolean" },
        questions: {
          type: ["array", "null"],
          items: {
            type: "object",
            additionalProperties: false,
            required: ["text"],
            properties: {
              text: { type: "string" },
              choices: { type: ["array", "null"], items: { type: "string" } }
            }
          }
        },
        triage: {
          type: ["object", "null"],
          additionalProperties: false,
          required: [],
          properties: {
            urgency: { type: "string", enum: ["danger", "urgent", "soon", "low"] },
            next_step: { type: "string" },
            specialists: { type: ["array", "null"], items: { type: "string" } },
            reasons: { type: ["array", "null"], items: { type: "string" } }
          }
        }
      }
    };

    const payload = {
      model,
      input: [
        { role: "system", content: system },
        ...trimmed
      ],
      text: {
        format: {
          type: "json_schema",
          name: "triage_reply",
          strict: true,
          schema
        }
      }
    };

    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!ai.ok) {
      const t = await ai.text().catch(() => "");
      return corsResponse({ error: "OpenAI error", status: ai.status, details: t.slice(0, 500) }, 502, env);
    }

    const data = await ai.json();
    const textOut = extractOutputText(data);

    let parsed = null;
    try {
      parsed = JSON.parse(textOut);
    } catch {
      // Fallback: return plain text
      parsed = { reply: textOut || "Nie udalo sie wygenerowac odpowiedzi.", done: false, questions: null, triage: null };
    }

    // Final guardrail: always ensure required keys
    const safe = {
      reply: String(parsed.reply || "").trim() || "Napisz prosze objawy w 1-2 zdaniach.",
      done: Boolean(parsed.done),
      questions: Array.isArray(parsed.questions) ? parsed.questions : null,
      triage: (parsed.triage && typeof parsed.triage === "object") ? parsed.triage : null
    };

    return corsResponse(safe, 200, env);
  }
};

function extractOutputText(responsesJson) {
  // Responses API shape: { output: [ { content: [ { type:"output_text", text:"..." } ] } ] }
  const output = Array.isArray(responsesJson?.output) ? responsesJson.output : [];
  let combined = "";
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (c && c.type === "output_text" && typeof c.text === "string") {
        combined += c.text;
      }
    }
  }
  return combined.trim();
}

function corsResponse(jsonBody, status, env) {
  const origin = (env && env.ALLOWED_ORIGIN) ? String(env.ALLOWED_ORIGIN) : "*";
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin"
  });
  if (status === 204) {
    return new Response(null, { status, headers });
  }
  return new Response(JSON.stringify(jsonBody), { status, headers });
}

