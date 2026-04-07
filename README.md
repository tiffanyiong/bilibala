
# Bilibala - AI-Powered Language Learning

> Turn any YouTube video into an interactive language learning experience with AI-powered conversation practice and real-time tutoring.

**Live App:** [bilibala.com](https://mybilibala.com)
---

## 🌟 What is Bilibala?

Bilibala is an **English speaking practice platform** that acts as your personal IELTS coach. It transforms YouTube videos into interactive speaking lessons, helping you improve your English fluency through structured practice and detailed feedback.

Using any English YouTube video as learning material, Bilibala helps you:

- **Learn from authentic content** — Paste a YouTube link and get AI-generated summaries, vocabulary lists, and topic breakdowns
- **Practice speaking with an AI tutor** — Have real-time voice conversations about the video content with Google's Gemini Live AI
- **Get IELTS-style feedback** — Receive detailed performance reports with scores on pronunciation, fluency, grammar, vocabulary, and comprehension
- **Track your improvement** — Save videos, review practice sessions, and monitor your speaking progress over time

### Who is it for?

- **IELTS test takers** preparing for the speaking section
- **English learners** who want to improve their speaking skills with authentic materials
- **Students** looking to practice English conversation in a low-pressure environment
- **Anyone** wanting structured feedback on their English speaking ability

---

## ✨ Key Features

### 📺 Smart Video Analysis
- Paste any English YouTube video link to automatically extract transcripts
- AI-generated summaries, topics, and vocabulary explanations
- Timeline highlights for quick navigation to key moments
- Works with any English content (documentaries, talks, podcasts, etc.)

### 🎙️ Live AI Tutor (Voice Conversation)
- Real-time English voice chat powered by Google Gemini Live API
- Adaptive tutoring based on proficiency level (beginner/intermediate/advanced)
- 4 tutor roles: Video Expert, Vocabulary Teacher, Grammar Coach, Conversation Partner
- Helps you practice speaking about the video content in natural English

### 🎯 IELTS-Style Speaking Practice
- Topic-based speaking exercises with AI-generated questions
- Real-time speech analysis across 5 criteria:
  - **Pronunciation** — Clarity and accent
  - **Fluency** — Speaking pace and hesitation
  - **Grammar** — Sentence structure and accuracy
  - **Vocabulary** — Word choice and range
  - **Comprehension** — Understanding of video content
- Instant feedback with detailed scoring pyramids (IELTS band scale)
- Practice reports with downloadable PDFs

### 📊 Progress Tracking & Analytics
- Personal video library with search and filtering
- Practice history with performance trends
- Detailed reports showing strengths and areas for improvement
- Export reports as PDFs for sharing or record-keeping

### 💎 Subscription System
- **Free tier:** 3 video analyses/month, 5 practice sessions/month
- **Pro tier:** 100 videos/month, unlimited practice, 60 AI tutor minutes/month
- Credit system for purchasing additional usage
- Stripe integration for payments

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS (custom glass morphism design)
- **State Management:** React Context API
- **Routing:** Custom SPA routing
- **UI Libraries:**
  - React YouTube for video playback
  - React Markdown for formatted content
  - ReactFlow for visual diagrams
  - FingerprintJS for device tracking

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **WebSocket:** `ws` library for real-time AI tutor connections
- **External API Integrations:**
  - **Google Gemini API** — AI content analysis, speech feedback, question generation (`gemini-2.5-flash`, `gemini-3-flash-preview`, Gemini Live for voice)
  - **Supadata API** — YouTube transcript extraction (native caption mode)
  - **YouTube.js (Innertube)** — Video metadata and duration fetching
  - **Google Cloud Text-to-Speech API** — AI voice generation for questions
  - **Stripe API** — Payment processing and subscription management
  - **DeepL API** — Translation service (optional, for vocabulary translation)
- **Security:** CORS, express-rate-limit, WebSocket authentication, Stripe webhook verification

### Database & Auth
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with Google OAuth (PKCE flow)
- **Storage:** Row-Level Security (RLS) policies for multi-tenancy
- **Migrations:** 27+ migrations tracking schema evolution

### Infrastructure
- **Hosting:** Railway
- **Domain:** Custom domain with SSL
- **Environment:** Production-ready with health checks and monitoring
- **Cron Jobs:** Automated cleanup tasks (expired sessions, Stripe sync)

### Audio Processing
- **Web Audio API:** Real-time audio capture and playback
- **Encoding:** PCM16 (16-bit linear PCM) for Gemini Live API
- **Text-to-Speech:** Google TTS for audio playback

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  React App (Vite) + WebSocket Client + Web Audio API    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTP/WS
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Backend Server (Node.js/Express)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ REST APIs    │  │ WebSocket    │  │ Stripe       │  │
│  │ (Video/TTS)  │  │ (AI Tutor)   │  │ Webhooks     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────┬─────────────────┬────────────────────────┘
              │                 │
              ▼                 ▼
    ┌─────────────────┐  ┌─────────────────┐
    │  Supabase       │  │  Google Gemini  │
    │  (PostgreSQL +  │  │  (AI Models)    │
    │   Auth)         │  │                 │
    └─────────────────┘  └─────────────────┘
```

### Key Design Principles
- **Security-first:** API keys never exposed to client, SECURITY DEFINER functions for safe credit operations
- **Feature-based architecture:** Organized by domain (live-voice, practice, library, etc.)
- **Shared context:** AuthContext, SubscriptionContext for global state
- **Caching:** LRU cache for video analyses, database caching for frequently accessed data
- **Anonymous usage:** Browser fingerprinting for free usage tracking before signup

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 20+
- Supabase account (for database and auth)
- Google Gemini API key
- Stripe account (for payments, optional for development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd bilibala
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create `server/.env` with:
   ```env
   # Google Gemini
   GEMINI_API_KEY=your_key_here
   GEMINI_API_VERSION=v1alpha
   GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025

   # Supabase
   SUPABASE_URL=your_project_url
   SUPABASE_SERVICE_KEY=your_service_key

   # Stripe (optional)
   STRIPE_SECRET_KEY=your_stripe_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   ```

   Create `.env` (for frontend) with:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_API_URL=http://localhost:3001
   VITE_WS_URL=ws://localhost:3001
   ```

4. **Run the development servers:**

   Terminal 1 (Backend):
   ```bash
   npm run dev:server
   ```

   Terminal 2 (Frontend):
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

---

## 📁 Project Structure

```
bilibala/
├── src/                           # Frontend source code
│   ├── features/                 # Feature modules (domain-driven)
│   │   ├── live-voice/          # AI tutor voice interface
│   │   ├── practice/            # Practice sessions & feedback
│   │   ├── library/             # Video library & history
│   │   ├── reports/             # Performance analytics
│   │   ├── subscription/        # Billing & usage
│   │   ├── profile/             # User settings
│   │   └── ...                  # Other features
│   ├── shared/                  # Shared code
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React Context providers
│   │   ├── services/           # API clients & utilities
│   │   ├── types/              # TypeScript types
│   │   └── hooks/              # Custom React hooks
│   ├── App.tsx                 # Main app component & routing
│   └── index.tsx               # Entry point
├── server/                       # Backend server
│   ├── index.js                # Express app & server setup
│   ├── routes/                 # API route handlers
│   ├── websocket/              # WebSocket handlers
│   ├── services/               # Business logic
│   └── utils/                  # Helper functions
├── docs/                         # Documentation
│   ├── migrations/             # Database migration history
│   └── ANALYTICS_QUERIES.md    # SQL queries for analytics
├── supabase/                     # Supabase configuration
│   └── migrations/             # Active database migrations
└── package.json                 # Dependencies & scripts
```

---

## 🔒 Security & Privacy

- **API Key Protection:** All sensitive API keys (Gemini, Supabase service key) are server-side only
- **Row-Level Security (RLS):** Database enforces user data isolation
- **Authentication:** OAuth 2.0 PKCE flow via Supabase
- **Session Management:** Device fingerprinting + concurrent session limits for Pro tier
- **Webhook Verification:** Stripe webhook signatures validated
- **Rate Limiting:** Express rate limiter on public endpoints

---

## 📦 Deployment

The app is configured for deployment on Railway:

1. **Build command:** `npm run build` (auto-updates version in package.json)
2. **Start command:** `npm start`
3. **Environment:** Set all env vars in Railway dashboard
4. **Health check:** `/api/health` endpoint
5. **Cron jobs:** Configured via Railway cron syntax in `railway.json`

---

## 📝 Key Documents

- **Frontend Architecture:** [src/README.md](src/README.md)
- **Analytics Queries:** [docs/ANALYTICS_QUERIES.md](docs/ANALYTICS_QUERIES.md)
- **Migration History:** [docs/migrations/](docs/migrations/)
- **Memory/Context:** [~/.claude/projects/.../memory/](~/.claude/projects/.../memory/)

---

## 📡 API Documentation

### Base URL
- **Development:** `http://localhost:3001/api`
- **Production:** `https://mybilibala.com/api`

### Authentication
Most endpoints support **anonymous access** with usage limits enforced via browser fingerprinting. Premium features require authentication via **Supabase JWT** passed in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

---

### Video Analysis Endpoints

#### `POST /api/fetch-transcript`
Fetches transcript for a YouTube video (fast, no AI processing).

**Request Body:**
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "targetLang": "English"
}
```

**Response:**
```json
{
  "transcript": [
    { "text": "Hello everyone", "offset": 0, "duration": 2000 }
  ],
  "transcriptLang": "en",
  "transcriptLangMismatch": false,
  "duration": 600
}
```

**Rate Limit:** 5 requests per 5 minutes
**Auth Required:** No

---

#### `POST /api/analyze-video-content`
Analyzes video and generates learning materials (summary, topics, vocabulary).

**Request Body:**
```json
{
  "videoTitle": "Video Title",
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "nativeLang": "Chinese (Mandarin - 中文)",
  "targetLang": "English",
  "level": "Medium",
  "preloadedTranscript": [] // Optional: pass transcript from /fetch-transcript
}
```

**Response:**
```json
{
  "summary": "AI-generated summary...",
  "topics": [
    {
      "id": "topic-1",
      "title": "Introduction",
      "startTime": 0,
      "endTime": 120,
      "summary": "...",
      "keyPoints": ["..."]
    }
  ],
  "vocabulary": [
    {
      "word": "resilience",
      "context": "original sentence",
      "translation": "韧性",
      "explanation": "...",
      "example": "..."
    }
  ],
  "transcript": [...],
  "duration": 600
}
```

**Rate Limit:** 3 requests per 5 minutes
**Usage Limit:** Free tier: 3/month, Pro: 100/month
**Auth Required:** No (limits enforced via fingerprint/subscription)

---

#### `POST /api/match-topics`
Matches transcript segments to AI-generated topics (used for timeline highlighting).

**Request Body:**
```json
{
  "topics": [...],
  "transcript": [...]
}
```

**Response:**
```json
{
  "topics": [
    {
      "id": "topic-1",
      "startTime": 5,
      "endTime": 125,
      "confidence": 0.95
    }
  ]
}
```

**Rate Limit:** 5 requests per minute
**Auth Required:** No

---

#### `POST /api/generate-question`
Generates a practice question based on video topic.

**Request Body:**
```json
{
  "topic": "Introduction to AI",
  "level": "Easy",
  "targetLang": "English",
  "videoContext": "Brief video summary..."
}
```

**Response:**
```json
{
  "question": "What is artificial intelligence?",
  "expectedKeyPoints": ["definition", "examples"],
  "difficulty": "Easy"
}
```

**Rate Limit:** 5 requests per minute
**Auth Required:** No

---

### Speech Analysis Endpoints

#### `POST /api/analyze-speech`
Analyzes recorded speech and provides IELTS-style feedback.

**Request Body:**
```json
{
  "audioData": "base64_encoded_audio",
  "topic": "Technology",
  "question": "What do you think about AI?",
  "level": "Medium",
  "targetLang": "English",
  "nativeLang": "Chinese (Mandarin - 中文)",
  "referenceTranscript": null // Optional: for retake mode
}
```

**Response:**
```json
{
  "scores": {
    "pronunciation": 7.5,
    "fluency": 7.0,
    "grammar": 8.0,
    "vocabulary": 7.5,
    "comprehension": 8.5,
    "overall": 7.7
  },
  "transcription": "User's spoken text...",
  "feedback": {
    "strengths": ["..."],
    "improvements": ["..."],
    "tips": ["..."]
  },
  "communicationLogic": {
    "detected": [...],
    "improved": [...]
  },
  "languagePolish": [
    {
      "original": "...",
      "improved": "...",
      "explanation": "..."
    }
  ]
}
```

**Rate Limit:** 5 requests per 10 minutes
**Usage Limit:** Free tier: 5 sessions/month, Pro: unlimited
**Auth Required:** No

---

#### `POST /api/tts`
Converts text to speech using Google Cloud TTS.

**Request Body:**
```json
{
  "text": "What is your favorite hobby?",
  "language": "English"
}
```

**Response:**
```json
{
  "audioUrl": "https://supabase-storage-url/...",
  "cached": true
}
```

**Rate Limit:** 30 requests per minute
**Auth Required:** No

---

### Translation Endpoints

#### `POST /api/translate-ui-labels`
Translates UI labels for internationalization.

**Request Body:**
```json
{
  "language": "Chinese (Mandarin - 中文)",
  "sourceLabels": {
    "pronunciation": "Pronunciation",
    "fluency": "Fluency",
    ...
  }
}
```

**Response:**
```json
{
  "labels": {
    "pronunciation": "发音",
    "fluency": "流利度",
    ...
  },
  "cached": true
}
```

**Rate Limit:** 10 requests per minute
**Auth Required:** No

---

#### `POST /api/translate/deepl`
Translates text using DeepL API (higher quality than Gemini for certain languages).

**Request Body:**
```json
{
  "text": "resilience",
  "sourceLang": "English",
  "targetLang": "Chinese (Mandarin - 中文)"
}
```

**Response:**
```json
{
  "translation": "韧性",
  "cached": false
}
```

**Rate Limit:** 30 requests per minute
**Auth Required:** No
**Note:** Not all languages supported on DeepL free tier

---

### AI Tutor (WebSocket)

#### `WebSocket /live`
Real-time voice conversation with Gemini Live API.

**Connection:**
```javascript
const ws = new WebSocket('wss://mybilibala.com/live');
```

**Authentication:**
```json
{
  "type": "auth",
  "token": "supabase_access_token",
  "config": {
    "targetLang": "English",
    "nativeLang": "Chinese (Mandarin - 中文)",
    "level": "Medium",
    "transcript": "Video transcript..."
  }
}
```

**Audio Streaming:**
```json
{
  "type": "audio",
  "audio": "base64_pcm16_audio_chunk"
}
```

**Server Events:**
- `sessionStart` — Session initialized
- `audio` — AI voice response (base64 PCM16)
- `transcript` — AI text response
- `limitReached` — Time limit reached
- `error` — Error message

**Usage Limit:** Free tier: 0 min/month, Pro: 60 min/month + purchased credits
**Auth Required:** Yes

---

### Subscription & Payment Endpoints

#### `POST /api/subscriptions/create-checkout`
Creates Stripe checkout session for Pro subscription.

**Request Body:**
```json
{
  "priceType": "monthly" // or "annual"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Auth Required:** Yes

---

#### `POST /api/subscriptions/create-credit-checkout`
Creates Stripe checkout for credit pack purchase.

**Request Body:**
```json
{
  "packType": "starter" // or "topup"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Auth Required:** Yes

---

#### `POST /api/subscriptions/create-portal`
Creates Stripe customer portal session (manage subscription, cancel, etc.).

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**Auth Required:** Yes

---

### Session Management Endpoints

#### `POST /api/sessions/register`
Registers a new device session (for concurrent device limit enforcement).

**Request Body:**
```json
{
  "sessionId": "uuid",
  "deviceFingerprint": "fingerprint_hash",
  "userAgent": "Mozilla/5.0...",
  "deviceInfo": { "browser": "Chrome", "os": "macOS" },
  "expiresAt": "2026-03-18T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "sessionLimit": 3,
  "loggedOutSessions": [],
  "loggedOutCount": 0
}
```

**Auth Required:** Yes
**Note:** Pro users have 3 concurrent device limit

---

#### `POST /api/sessions/heartbeat`
Updates session activity timestamp (keeps session alive).

**Request Body:**
```json
{
  "sessionId": "uuid"
}
```

**Auth Required:** Yes

---

### Video Library Endpoints

#### `POST /api/search-videos`
Searches user's saved video history.

**Request Body:**
```json
{
  "searchQuery": "technology",
  "sortBy": "recent",
  "targetLang": "English",
  "level": "Medium"
}
```

**Response:**
```json
{
  "videos": [
    {
      "id": "uuid",
      "video_id": "dQw4w9WgXcQ",
      "title": "...",
      "created_at": "2026-03-17T...",
      "analysis_data": {...}
    }
  ]
}
```

**Auth Required:** Yes

---

### Analytics Endpoints

#### `POST /api/analytics/page-visit`
Tracks landing page visits for analytics.

**Request Body:**
```json
{
  "fingerprint": "device_fingerprint_hash"
}
```

**Response:**
```json
{
  "success": true
}
```

**Auth Required:** No

---

### Health Check

#### `GET /healthz`
Server health check endpoint.

**Response:**
```json
{
  "ok": true
}
```

---

### Rate Limiting

All endpoints are rate-limited to prevent abuse:

| Endpoint | Limit |
|----------|-------|
| `/api/fetch-transcript` | 5 req / 5 min |
| `/api/analyze-video-content` | 3 req / 5 min |
| `/api/analyze-speech` | 5 req / 10 min |
| `/api/tts` | 30 req / min |
| `/api/translate/*` | 30 req / min |
| `/api/conversation-hints` | 5 req / min |
| `/api/search-videos` | 20 req / min |

Rate limit headers are returned in responses:
- `X-RateLimit-Limit` — Total requests allowed
- `X-RateLimit-Remaining` — Requests remaining
- `X-RateLimit-Reset` — Time when limit resets (Unix timestamp)

---

## 🤝 Contributing

This is a personal project, but if you'd like to contribute or report issues, please reach out!

---

## 📄 License

© 2026 Bilibala. All rights reserved.

---
