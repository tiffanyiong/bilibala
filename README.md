
# Bilibala - AI-Powered Language Learning

> Turn any YouTube video into an interactive language learning experience with AI-powered conversation practice and real-time tutoring.

**Live App:** [bilibala.com](https://bilibala.com) | **Demo:** [AI Studio](https://ai.studio/apps/drive/13lr0mWX_h8UJHtvB60R2XZ4_HGqeCyPt)

---

## 🌟 What is Bilibala?

Bilibala is a language learning platform that transforms YouTube videos into interactive lessons. Whether you're learning English, Spanish, Japanese, or any of 15+ languages, Bilibala helps you:

- **Learn from any YouTube video** — Paste a link and get instant AI-generated summaries, vocabulary lists, and topic breakdowns
- **Practice speaking with an AI tutor** — Have real-time voice conversations about the video content with Google's Gemini Live AI
- **Track your progress** — Get detailed performance reports with pronunciation, fluency, and comprehension scores
- **Build your library** — Save videos, review practice sessions, and monitor your improvement over time

### Who is it for?

- **Language learners** who want to practice speaking and comprehension with authentic content
- **Students** looking for interactive study materials from YouTube
- **Teachers** who want to assign video-based practice to students
- **Anyone** interested in immersive, AI-assisted language learning

---

## ✨ Key Features

### 📺 Smart Video Analysis
- Paste any YouTube link to automatically extract transcripts
- AI-generated summaries, topics, and vocabulary with translations
- Timeline highlights for quick navigation
- Support for 15+ languages

### 🎙️ Live AI Tutor (Voice Conversation)
- Real-time voice chat powered by Google Gemini Live API
- Adaptive tutoring based on proficiency level (beginner/intermediate/advanced)
- 4 tutor roles: Video Expert, Vocabulary Teacher, Grammar Coach, Conversation Partner
- Contextual hints and explanations in your native language

### 🎯 Interactive Practice Sessions
- Topic-based speaking exercises with AI-generated questions
- Real-time speech analysis (pronunciation, fluency, grammar, vocabulary)
- Instant feedback with detailed scoring pyramids
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
- **API Integration:**
  - Google Gemini API (Flash & Live models)
  - YouTube Transcript API (`youtube-transcript`, `youtubei.js`)
  - Supadata Transcript API
  - Stripe API for payments
- **Security:** CORS, rate limiting, WebSocket authentication

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

## 🤝 Contributing

This is a personal project, but if you'd like to contribute or report issues, please reach out!

---

## 📄 License

© 2026 Bilibala. All rights reserved.

---
