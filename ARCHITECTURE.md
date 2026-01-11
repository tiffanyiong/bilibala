# 🏗️ Bilibala Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React Frontend (Vite)                     │  │
│  │  Port: 3000                                            │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │   App    │  │ Features │  │  Shared  │           │  │
│  │  │  Router  │─▶│ Modules  │◀─│Components│           │  │
│  │  └──────────┘  └──────────┘  └──────────┘           │  │
│  │       │             │              │                  │  │
│  │       └─────────────┴──────────────┘                  │  │
│  │                     │                                  │  │
│  │              HTTP + WebSocket                         │  │
│  └─────────────────────┼─────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js Backend Server                          │
│  Port: 3001                                                  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ REST API     │  │  WebSocket   │  │   Gemini     │     │
│  │ Endpoints    │  │   Proxy      │  │  API Client  │     │
│  │              │  │              │  │              │     │
│  │ /api/analyze │  │ /live        │  │ - Flash API  │     │
│  │ /api/hints   │  │              │  │ - Live API   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                    GEMINI_API_KEY                           │
│                      (Secure)                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Google Gemini   │
                  │      API         │
                  └──────────────────┘
```

## Frontend Architecture (Feature-Based)

```
src/
│
├── features/                    # 🎯 Feature Modules
│   │
│   ├── live-voice/             # 🎤 Live Voice Interaction
│   │   ├── components/
│   │   │   ├── LiveVoiceInterface.tsx    # Main voice UI
│   │   │   ├── DuckAvatar.tsx            # Animated avatar
│   │   │   └── RescueRing.tsx            # Help button
│   │   ├── services/
│   │   │   └── audioUtils.ts             # Audio processing
│   │   └── index.ts                      # Public exports
│   │
│   ├── chat/                   # 💬 Chat & Transcript
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx         # Text chat UI
│   │   │   └── Transcript.tsx            # Conversation history
│   │   └── index.ts
│   │
│   ├── video/                  # 🎥 Video Integration
│   │   ├── components/
│   │   │   └── VideoPlayer.tsx           # YouTube player
│   │   ├── services/
│   │   │   └── youtubeService.ts         # Video metadata
│   │   └── index.ts
│   │
│   └── content/                # 📚 Content Display
│       ├── components/
│       │   ├── ContentTabs.tsx           # Tab navigation
│       │   ├── TopicCard.tsx             # Topic display
│       │   └── VocabularyCard.tsx        # Vocab display
│       └── index.ts
│
├── shared/                      # 🔧 Shared Resources
│   ├── components/
│   │   ├── Layout.tsx                    # App layout
│   │   ├── ControlBar.tsx                # Voice controls
│   │   ├── StatusPill.tsx                # Status indicator
│   │   └── icons/
│   │       └── LiveIcons.tsx             # SVG icons
│   ├── services/
│   │   ├── backend.ts                    # Backend API client
│   │   └── geminiService.ts              # Gemini API wrapper
│   ├── types/
│   │   └── index.ts                      # TypeScript types
│   ├── constants.ts                      # App constants
│   └── index.ts                          # Public exports
│
├── App.tsx                      # 🎯 Main App Component
└── index.tsx                    # 🚀 Entry Point
```

## Data Flow

### 1. Video Analysis Flow
```
User enters YouTube URL
    │
    ▼
App.tsx (handleStart)
    │
    ▼
youtubeService.fetchVideoMetadata()
    │
    ▼
Backend: POST /api/analyze-video-content
    │
    ▼
Gemini Flash API (Content Analysis)
    │
    ▼
Backend returns: { summary, topics, vocabulary }
    │
    ▼
ContentTabs displays results
```

### 2. Live Voice Interaction Flow
```
User clicks "Jump In!"
    │
    ▼
LiveVoiceInterface.handleStartSession()
    │
    ├─▶ Request microphone access
    │
    ├─▶ Connect to backend WebSocket (ws://localhost:3001/live)
    │
    ├─▶ Send initial prompt (text)
    │
    └─▶ Start streaming audio chunks (binary)
         │
         ▼
Backend WebSocket Handler
    │
    ├─▶ Connect to Gemini Live API
    │
    ├─▶ Forward audio chunks
    │
    └─▶ Stream responses back to frontend
         │
         ▼
Frontend receives:
    ├─▶ Audio responses (play via Web Audio API)
    ├─▶ Text transcripts (display in Transcript)
    └─▶ Status updates (show in StatusPill)
```

### 3. Conversation Hints Flow
```
User clicks "Rescue Ring" (lifebuoy icon)
    │
    ▼
LiveVoiceInterface.handleManualHint()
    │
    ▼
Backend: POST /api/conversation-hints
    │
    ▼
Gemini Flash API (Generate hints)
    │
    ▼
Backend returns: { hints: string[] }
    │
    ▼
RescueRing displays hints
```

## Component Relationships

```
App.tsx
  │
  ├─▶ Layout (shared)
  │     └─▶ Header with logo, language, level
  │
  ├─▶ Landing Page
  │     ├─▶ Language selectors
  │     ├─▶ Level selector
  │     └─▶ YouTube URL input
  │
  ├─▶ Dashboard View
  │     ├─▶ VideoPlayer (video feature)
  │     ├─▶ ContentTabs (content feature)
  │     │     ├─▶ TopicCard
  │     │     └─▶ VocabularyCard
  │     └─▶ "Jump In!" button
  │
  └─▶ Call Session View
        ├─▶ LiveVoiceInterface (live-voice feature)
        │     ├─▶ DuckAvatar
        │     ├─▶ RescueRing
        │     ├─▶ ControlBar (shared)
        │     ├─▶ StatusPill (shared)
        │     └─▶ Transcript (chat feature)
        │
        └─▶ ContentTabs (reference material)
```

## Backend API Endpoints

### REST Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/healthz` | GET | Health check | - | `{ ok: true }` |
| `/api/analyze-video-content` | POST | Analyze video for learning content | `{ videoTitle, nativeLang, targetLang, level }` | `{ summary, topics, vocabulary }` |
| `/api/conversation-hints` | POST | Generate conversation hints | `{ history, videoTitle, vocabulary, nativeLang, targetLang }` | `{ hints: string[] }` |

### WebSocket Endpoint

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `/live` | WebSocket | Proxy for Gemini Live API (bidirectional audio/text streaming) |

#### WebSocket Message Types (Frontend → Backend)

```typescript
// Start session
{ type: 'start', prompt: string }

// Audio chunk (binary frame)
ArrayBuffer (PCM16, 16kHz)

// Text message
{ type: 'text', text: string }

// Stop session
{ type: 'stop' }
```

#### WebSocket Message Types (Backend → Frontend)

```typescript
// Status update
{ type: 'status', status: 'connected' | 'disconnected' }

// Error
{ type: 'error', error: string }

// Gemini Live event
{ type: 'live', event: GeminiLiveEvent }
```

## Security Considerations

1. **API Key Protection:**
   - ✅ Gemini API key stored in `server/.env` (not committed to git)
   - ✅ Backend handles all Gemini API calls
   - ✅ Frontend never sees the API key

2. **CORS Configuration:**
   - Backend allows requests from frontend origin
   - Credentials enabled for secure cookies (if needed)

3. **Environment Variables:**
   - Frontend: `import.meta.env.VITE_*` (build-time only, safe to expose)
   - Backend: `process.env.*` (runtime, kept secret)

## Performance Optimizations

1. **Audio Processing:**
   - Client-side downsampling to 16kHz before sending
   - Binary WebSocket frames for efficient audio transfer
   - Audio buffering to handle network latency

2. **Component Loading:**
   - Feature-based code splitting potential
   - Lazy loading for heavy components

3. **State Management:**
   - React hooks for local state
   - Minimal prop drilling via feature isolation

## Development Workflow

1. **Start Backend:**
   ```bash
   npm run dev:server
   # Runs: node server/index.js
   # Listens on: http://0.0.0.0:3001
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   # Runs: vite
   # Listens on: http://localhost:3000
   # Proxies /api and /live to backend
   ```

3. **Build for Production:**
   ```bash
   npm run build
   # Output: dist/
   ```

## Deployment Considerations

1. **Environment Variables:**
   - Set `GEMINI_API_KEY`, `GEMINI_API_VERSION`, `GEMINI_LIVE_MODEL` on server
   - Set `HOST=0.0.0.0` and `PORT` as needed

2. **CORS:**
   - Update backend CORS origin to match production domain

3. **WebSocket:**
   - Ensure WebSocket connections are supported by hosting provider
   - Consider using `wss://` (secure WebSocket) in production

4. **Static Assets:**
   - Serve frontend build from CDN or static hosting
   - Backend serves API and WebSocket only
