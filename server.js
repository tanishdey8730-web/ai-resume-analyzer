/**
 * ResumeIQ — Backend API Server
 * Node.js + Express + Anthropic SDK
 *
 * Install:  npm install
 * Run:      node server.js
 * Dev:      npm run dev   (uses nodemon)
 */

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const Anthropic  = require('@anthropic-ai/sdk');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── Middleware ─── */
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));   // Serve index.html

/* ─── Anthropic Client ─── */
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/* ════════════════════════════════════════════
   POST /api/analyze
   Body: { resumeText, targetRole?, company?, industry?,
           workMode?, jobType?, experience?, resumeType?, jobDesc? }
   Returns: JSON analysis object
════════════════════════════════════════════ */
app.post('/api/analyze', async (req, res) => {
  const {
    resumeText, targetRole = '', company = '', industry = '',
    workMode = '', jobType = '', experience = '', resumeType = '', jobDesc = ''
  } = req.body;

  /* ── Validation ── */
  if (!resumeText || typeof resumeText !== 'string') {
    return res.status(400).json({ error: 'resumeText is required.' });
  }
  if (resumeText.trim().length < 80) {
    return res.status(400).json({ error: 'Resume text is too short. Please paste your full resume.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  /* ── Build prompt ── */
  const contextLines = [];
  if (targetRole)   contextLines.push(`Target role: ${targetRole}`);
  if (company)      contextLines.push(`Company: ${company}`);
  if (industry)     contextLines.push(`Industry: ${industry}`);
  if (workMode)     contextLines.push(`Work mode: ${workMode}`);
  if (jobType)      contextLines.push(`Employment type: ${jobType}`);
  if (experience)   contextLines.push(`Experience level: ${experience}`);
  if (resumeType)   contextLines.push(`Resume type: ${resumeType}`);
  const contextBlock = contextLines.length ? contextLines.join('\n') + '\n' : '';

  const jobDescBlock = jobDesc
    ? `\nJob description (use for keyword gap analysis):\n"""\n${jobDesc.slice(0, 3000)}\n"""\n`
    : '';

  const prompt = `You are an expert resume coach, recruiter, and ATS specialist with 15+ years of experience.

Analyze the resume below and return ONLY a valid JSON object — no markdown, no backticks, no commentary.

${contextBlock}${jobDescBlock}
Resume:
"""
${resumeText.slice(0, 7000)}
"""

Return EXACTLY this JSON structure (all fields required):
{
  "overallScore":  <integer 0-100>,
  "atsScore":      <integer 0-100, how well it passes ATS systems>,
  "impactScore":   <integer 0-100, quality of achievements and quantified results>,
  "keywordScore":  <integer 0-100, keyword richness for the role>,
  "summary": "<2-3 sentence executive-style summary: current standing + top opportunity>",
  "categories": [
    { "name": "Work experience",    "score": <0-100> },
    { "name": "Skills section",     "score": <0-100> },
    { "name": "Education",          "score": <0-100> },
    { "name": "Quantified results", "score": <0-100> },
    { "name": "Formatting clarity", "score": <0-100> },
    { "name": "Action verbs",       "score": <0-100> }
  ],
  "matchedKeywords": [<array of up to 12 strong keywords found in the resume>],
  "missingKeywords": [<array of up to 10 important keywords missing for the target role or industry>],
  "strengths": [
    "<specific strength 1>",
    "<specific strength 2>",
    "<specific strength 3>",
    "<specific strength 4>"
  ],
  "improvements": [
    "<specific weakness 1>",
    "<specific weakness 2>",
    "<specific weakness 3>",
    "<specific weakness 4>"
  ],
  "tips": [
    "<concrete, actionable tip 1>",
    "<concrete, actionable tip 2>",
    "<concrete, actionable tip 3>",
    "<concrete, actionable tip 4>",
    "<concrete, actionable tip 5>"
  ]
}

Scoring guidance:
- overallScore: weighted average (experience 30%, ATS 25%, impact 25%, keywords 20%)
- atsScore: penalize graphics, tables, headers/footers, uncommon section names, missing contact info
- impactScore: reward percentages, dollar amounts, team sizes, specific metrics; penalize vague duties
- keywordScore: judge against ${targetRole || 'the role suggested by the resume'}${company ? ` at ${company}` : ''}
- Be honest and calibrated — most resumes score 45–70. Reserve 85+ for genuinely excellent ones.
- All point strings must be clear and specific, referencing actual resume content where possible.
`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 1200,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    /* Extract text content */
    const rawText = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    /* Strip any accidental markdown fences */
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      console.error('JSON parse error. Raw response:\n', rawText);
      return res.status(500).json({ error: 'AI returned malformed JSON. Please try again.' });
    }

    /* Clamp all scores to 0–100 */
    for (const key of ['overallScore', 'atsScore', 'impactScore', 'keywordScore']) {
      if (typeof parsed[key] === 'number') {
        parsed[key] = Math.max(0, Math.min(100, Math.round(parsed[key])));
      }
    }
    if (Array.isArray(parsed.categories)) {
      parsed.categories = parsed.categories.map(c => ({
        ...c,
        score: Math.max(0, Math.min(100, Math.round(c.score || 0)))
      }));
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Anthropic API error:', err);

    if (err.status === 401) {
      return res.status(500).json({ error: 'Invalid Anthropic API key. Check your .env file.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Rate limit reached. Please wait a moment and try again.' });
    }

    return res.status(500).json({ error: err.message || 'Unknown server error.' });
  }
});

/* ─── Health check ─── */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time:   new Date().toISOString(),
    model:  'claude-opus-4-5'
  });
});

/* ─── Fallback: serve index.html for any non-API route ─── */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ─── Start server ─── */
app.listen(PORT, () => {
  console.log(`\n🚀  ResumeIQ server running at http://localhost:${PORT}`);
  console.log(`    API key: ${process.env.ANTHROPIC_API_KEY ? '✅  configured' : '❌  MISSING — set ANTHROPIC_API_KEY in .env'}`);
  console.log(`    Endpoint: POST http://localhost:${PORT}/api/analyze\n`);
});

