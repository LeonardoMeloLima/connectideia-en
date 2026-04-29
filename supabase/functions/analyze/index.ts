import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as cheerio from "npm:cheerio@1.0.0";

const ALLOWED_ORIGINS = new Set<string>([
  "https://www.connectideia.com",
  "https://connectideia.com",
  "https://connectideia-en.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const RATE_LIMIT_PER_MIN = 5;
const RATE_WINDOW_MS = 60_000;
// Best-effort, per-isolate. Edge Function isolates are reused for short windows,
// so this catches rapid abuse from the same IP without persistent storage.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

const CONNECT_SERVICES: Record<string, Record<string, string>> = {
  idea: {
    lp: "Validation LP: capture leads and test real demand before investing in the full product",
    app: "PWA MVP: launch a minimum viable product to validate with real users before scaling",
    automation: "Automated support from day one: operate without a large team via WhatsApp and intelligent CRMs",
    ecosystem: "Ecosystem from scratch: validation LP + MVP + automated support — a solid digital base from day 1",
  },
  operating: {
    lp: "High-conversion LP: turn current traffic into qualified leads with premium copy and design",
    app: "Custom app: digitize processes and operations to gain efficiency without growing the team",
    automation: "Operational automation: eliminate bottlenecks in support, sales and CRM with intelligent flows",
    ecosystem: "Ecosystem integration: connect LP, App and automations into a cohesive stack that runs itself",
  },
  scaling: {
    lp: "Segmented high-conversion LPs: multiply lead capture to support accelerated growth",
    app: "App as a revenue channel: your own digital product to scale without depending on third-party platforms",
    automation: "Automation at scale: handle growing volumes of support and sales without proportional team costs",
    ecosystem: "Scalable ecosystem: LP + App + Automation working as one integrated growth machine",
  },
};

function getService(phase: string | undefined, bottleneck: string | undefined): string {
  const p = (phase || "").toLowerCase();
  const b = (bottleneck || "").toLowerCase();

  let phaseKey = "operating";
  if (p.includes("idea") || p.includes("early") || p.includes("start")) phaseKey = "idea";
  else if (p.includes("scal") || p.includes("growth") || p.includes("grow")) phaseKey = "scaling";

  let bottleneckKey = "ecosystem";
  if (b.includes("lp") || b.includes("landing") || b.includes("convert") || b.includes("sale")) bottleneckKey = "lp";
  else if (b.includes("app") || b.includes("pwa") || b.includes("product")) bottleneckKey = "app";
  else if (b.includes("autom") || b.includes("process") || b.includes("support")) bottleneckKey = "automation";

  return CONNECT_SERVICES[phaseKey][bottleneckKey];
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MIN;
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: { url?: string; phase?: string; bottleneck?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { url, phase, bottleneck } = body;
  if (!url) {
    return new Response(JSON.stringify({ error: "URL is required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error("[analyze] GEMINI_API_KEY not configured");
    return new Response(JSON.stringify({ success: true, skipped: "MISSING_KEY" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }

    let siteContent = "";

    try {
      console.log("[analyze] Trying Jina AI:", finalUrl);
      const jinaResponse = await fetch(`https://r.jina.ai/${finalUrl}`, {
        headers: { "Accept": "text/plain", "X-Return-Format": "text" },
        signal: AbortSignal.timeout(10_000),
      });
      if (jinaResponse.ok) {
        const rawText = await jinaResponse.text();
        siteContent = rawText.substring(0, 6000).trim();
      }
    } catch (e) {
      console.warn("[analyze] Jina failed or timed out:", (e as Error).message);
    }

    if (siteContent.length < 150) {
      try {
        console.log("[analyze] Plan B (Cheerio):", finalUrl);
        const directResponse = await fetch(finalUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(8_000),
        });
        if (directResponse.ok) {
          const html = await directResponse.text();
          const $ = cheerio.load(html);
          $("script, style, nav, footer, noscript, svg, i, .menu, .nav").remove();
          siteContent = $("body").text().replace(/\s+/g, " ").substring(0, 4500).trim();
          console.log("[analyze] Plan B captured:", siteContent.length, "chars");
        }
      } catch (e) {
        console.error("[analyze] Plan B failed:", (e as Error).message);
      }
    }

    if (siteContent.length < 80) {
      console.error("[analyze] Total failure reading the site");
      return new Response(JSON.stringify({ success: true, skipped: "SCRAPE_FAIL" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const servicoIdeal = getService(phase, bottleneck);

    const prompt = `You are the intelligence engine of ConnectIdeia, a high-end technology and digital products company.
Your job is to analyze a potential client's business and deliver a short, surgical and highly persuasive diagnosis that proves we deeply understand their business — and that we have the exact solution for the stage they're in.

## What the client told us in the chat:
- Current business stage: ${phase || "Not informed"}
- Main bottleneck stated: ${bottleneck || "Not informed"}

## Real content extracted from the client's site (${finalUrl}):
${siteContent}

## ConnectIdeia solution calibrated for this stage + bottleneck:
${servicoIdeal}

## Your task:
Analyze the site and the client's answers together. The business stage shifts the angle of the recommendation:
- Idea stage → focus on validation, first product, digital foundation
- Operating stage → focus on conversion, efficiency, eliminating bottlenecks
- Scaling stage → focus on volume, growth, automation without proportional cost

Based on this, identify:
1. What this business does (segment, product, audience)
2. The main digital GAP the site reveals given the stage they're in
3. The exact action ConnectIdeia delivers to solve that GAP at this stage — with a tangible outcome

Generate the diagnosis in this exact JSON format:
{
  "negocio": "sentence identifying the business with precision",
  "gap": "sentence about the main digital problem detected on the site, in the context of the current stage",
  "acao": "sentence connecting stage + bottleneck to what ConnectIdeia solves — with a tangible outcome"
}

Rules:
- EACH FIELD must have AT MOST 2 lines (up to 25 words). Be surgical — senior consultant diagnosis, not a report
- The business stage MUST influence the tone and angle of the recommended action
- Use real data from the site, do not invent
- The action must mention a tangible outcome (e.g., 3x more leads, 80% less manual support, validate in 30 days)
- NEVER use quotation marks inside the JSON values
- Return ONLY the JSON, no explanations
- WRITE EVERYTHING IN ENGLISH`;

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("[analyze] Gemini error:", geminiResponse.status, errText);
      return new Response(JSON.stringify({ success: true, skipped: "LLM_FAIL" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const responseText = (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    console.log("[analyze] Gemini response:", responseText);

    let analysis: { negocio?: string; gap?: string; acao?: string } | null = null;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : null;
    }

    if (!analysis || !analysis.negocio) {
      console.error("[analyze] Invalid or empty AI response");
      return new Response(JSON.stringify({ success: true, skipped: "LLM_FAIL" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          negocio: analysis.negocio,
          gap: analysis.gap,
          acao: analysis.acao,
        },
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[analyze] Critical error:", (err as Error).message);
    return new Response(
      JSON.stringify({ success: true, skipped: "ERROR", message: (err as Error).message }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
