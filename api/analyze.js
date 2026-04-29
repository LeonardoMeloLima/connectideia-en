import { GoogleGenerativeAI } from '@google/generative-ai';

// ConnectIdeia services matrix: phase × bottleneck (3 phases × 4 bottlenecks = 12 combinations)
const CONNECT_SERVICES = {
  'idea': {
    'lp':           'Validation LP: capture leads and test real demand before investing in the full product',
    'app':          'PWA MVP: launch a minimum viable product to validate with real users before scaling',
    'automation':   'Automated support from day one: operate without a large team via WhatsApp and intelligent CRMs',
    'ecosystem':    'Ecosystem from scratch: validation LP + MVP + automated support — a solid digital base from day 1'
  },
  'operating': {
    'lp':           'High-conversion LP: turn current traffic into qualified leads with premium copy and design',
    'app':          'Custom app: digitize processes and operations to gain efficiency without growing the team',
    'automation':   'Operational automation: eliminate bottlenecks in support, sales and CRM with intelligent flows',
    'ecosystem':    'Ecosystem integration: connect LP, App and automations into a cohesive stack that runs itself'
  },
  'scaling': {
    'lp':           'Segmented high-conversion LPs: multiply lead capture to support accelerated growth',
    'app':          'App as a revenue channel: your own digital product to scale without depending on third-party platforms',
    'automation':   'Automation at scale: handle growing volumes of support and sales without proportional team costs',
    'ecosystem':    'Scalable ecosystem: LP + App + Automation working as one integrated growth machine'
  }
};

function getService(phase, bottleneck) {
  const p = (phase || '').toLowerCase();
  const b = (bottleneck || '').toLowerCase();

  let phaseKey = 'operating';
  if (p.includes('idea') || p.includes('early') || p.includes('start')) phaseKey = 'idea';
  else if (p.includes('scal') || p.includes('growth') || p.includes('grow')) phaseKey = 'scaling';

  let bottleneckKey = 'ecosystem';
  if (b.includes('lp') || b.includes('landing') || b.includes('convert') || b.includes('sale')) bottleneckKey = 'lp';
  else if (b.includes('app') || b.includes('pwa') || b.includes('product')) bottleneckKey = 'app';
  else if (b.includes('autom') || b.includes('process') || b.includes('support')) bottleneckKey = 'automation';

  return CONNECT_SERVICES[phaseKey][bottleneckKey];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { url, phase, bottleneck } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const geminiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!geminiKey) {
    console.error('[analyze.js] Error: GEMINI_API_KEY not found in environment.');
    return res.status(200).json({ success: true, skipped: 'MISSING_KEY' });
  }

  try {
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    let siteContent = '';
    let usedPlanoB = false;

    // 1. Scraping with Jina AI Reader (primary — handles JS well)
    try {
      console.log('[analyze.js] Trying Jina AI:', finalUrl);
      const jinaResponse = await fetch(`https://r.jina.ai/${finalUrl}`, {
        headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
        signal: AbortSignal.timeout(10000)
      });
      if (jinaResponse.ok) {
        const rawText = await jinaResponse.text();
        siteContent = rawText.substring(0, 6000).trim();
      }
    } catch (e) {
      console.warn('[analyze.js] Jina failed or timed out:', e.message);
    }

    // 2. Plan B: direct fetch + Cheerio
    if (siteContent.length < 150) {
      try {
        console.log('[analyze.js] Starting Plan B (Cheerio):', finalUrl);
        const directResponse = await fetch(finalUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(8000)
        });
        if (directResponse.ok) {
          const html = await directResponse.text();
          const cheerio = await import('cheerio');
          const $ = cheerio.load(html);
          $('script, style, nav, footer, noscript, svg, i, .menu, .nav').remove();
          siteContent = $('body').text().replace(/\s+/g, ' ').substring(0, 4500).trim();
          usedPlanoB = true;
          console.log('[analyze.js] Plan B captured:', siteContent.length, 'chars');
        }
      } catch (e) {
        console.error('[analyze.js] Plan B also failed:', e.message);
      }
    }

    if (siteContent.length < 80) {
      console.error('[analyze.js] Total failure reading the site.');
      return res.status(200).json({ success: true, skipped: 'SCRAPE_FAIL' });
    }

    const servicoIdeal = getService(phase, bottleneck);

    const prompt = `You are the intelligence engine of ConnectIdeia, a high-end technology and digital products company.
Your job is to analyze a potential client's business and deliver a short, surgical and highly persuasive diagnosis that proves we deeply understand their business — and that we have the exact solution for the stage they're in.

## What the client told us in the chat:
- Current business stage: ${phase || 'Not informed'}
- Main bottleneck stated: ${bottleneck || 'Not informed'}

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

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    console.log('[analyze.js] Calling Gemini with cross-analysis...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    console.log('[analyze.js] Gemini response:', responseText);

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (e) {
      const match = responseText.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : null;
    }

    if (!analysis || !analysis.negocio) {
      console.error('[analyze.js] Invalid or empty AI response.');
      return res.status(200).json({ success: true, skipped: 'LLM_FAIL' });
    }

    return res.status(200).json({
      success: true,
      analysis: {
        negocio: analysis.negocio,
        gap: analysis.gap,
        acao: analysis.acao
      }
    });

  } catch (err) {
    console.error('[analyze.js] Critical handler error:', err.message);
    return res.status(200).json({ success: true, skipped: 'ERROR', message: err.message });
  }
}
