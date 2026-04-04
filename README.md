# ResumeIQ — AI Resume Analyzer

A full-stack AI-powered resume analyzer with a dark editorial frontend and
a Node.js/Express backend powered by Anthropic's Claude API.

---

## Tech stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | Vanilla HTML · CSS · JavaScript    |
| Backend  | Node.js · Express 4                |
| AI       | Anthropic Claude (claude-opus-4-5) |
| Fonts    | Cormorant Garamond · Syne          |

---

## Project structure

```
resume-analyzer/
├── index.html      ← Frontend (served statically by Express)
├── server.js       ← Express API server
├── package.json
├── .env.example    ← Copy to .env and add your API key
└── README.md
```

---

## Quick start

### 1. Install dependencies

```bash
cd resume-analyzer
npm install
```

### 2. Configure your API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with your real key:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
```

Get a key at: https://console.anthropic.com/settings/keys

### 3. Start the server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

### 4. Open in browser

```
http://localhost:3000
```

---

## API Reference

### POST /api/analyze

**Request body (JSON):**

| Field        | Type   | Required | Description                                 |
|--------------|--------|----------|---------------------------------------------|
| resumeText   | string | ✅       | Full resume text (min 80 chars, max ~7000)  |
| targetRole   | string | —        | Target job title                            |
| industry     | string | —        | Industry context                            |
| experience   | string | —        | entry / mid / senior / executive            |
| resumeType   | string | —        | chronological / functional / hybrid         |
| jobDesc      | string | —        | Job description for keyword gap analysis    |

**Response (JSON):**

```json
{
  "overallScore":  75,
  "atsScore":      68,
  "impactScore":   80,
  "keywordScore":  72,
  "summary":       "Strong technical background with...",
  "categories": [
    { "name": "Work experience",    "score": 82 },
    { "name": "Skills section",     "score": 75 },
    { "name": "Education",          "score": 70 },
    { "name": "Quantified results", "score": 65 },
    { "name": "Formatting clarity", "score": 80 },
    { "name": "Action verbs",       "score": 78 }
  ],
  "matchedKeywords": ["Python", "AWS", "Agile", "..."],
  "missingKeywords": ["Kubernetes", "CI/CD", "..."],
  "strengths":     ["..."],
  "improvements":  ["..."],
  "tips":          ["..."]
}
```

### GET /api/health

Returns server status and timestamp.

---

## Deployment

### Railway / Render / Fly.io

1. Push the folder to a GitHub repo
2. Connect the repo to your platform
3. Add `ANTHROPIC_API_KEY` as an environment variable
4. Set start command: `node server.js`

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Privacy

All analysis happens in real-time. No resume text is stored, logged,
or sent anywhere other than the Anthropic API endpoint.
