<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🦆 Bilibala - Language Pool Party

Turn any YouTube video into a refreshing language learning experience with AI-powered conversation practice.

View your app in AI Studio: https://ai.studio/apps/drive/13lr0mWX_h8UJHtvB60R2XZ4_HGqeCyPt

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `server/env.example` to `server/.env`
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=YOUR_KEY_HERE
     GEMINI_API_VERSION=v1alpha
     GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
     ```

3. **Start the backend server (Terminal 1):**
   ```bash
   npm run dev:server
   ```

4. **Start the React app (Terminal 2):**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## 🏗️ Architecture

This app uses a **client-server architecture** for security and scalability:

- **Frontend (React + Vite):** Handles UI, audio capture, and real-time interaction
- **Backend (Node.js + Express):** Securely manages Gemini API calls and WebSocket proxying
- **Security:** Your Gemini API key never leaves the backend server

### Project Structure

```
bilibala/
├── src/                    # Frontend source code
│   ├── features/          # Feature-based modules
│   │   ├── live-voice/   # Live AI tutor interaction
│   │   ├── chat/         # Chat and transcript
│   │   ├── video/        # YouTube video integration
│   │   └── content/      # Content display (tabs, cards)
│   ├── shared/           # Shared components, services, types
│   ├── App.tsx           # Main app component
│   └── index.tsx         # Entry point
├── server/               # Backend server
│   ├── index.js         # Express + WebSocket server
│   └── .env             # API keys (not committed)
└── package.json         # Dependencies and scripts
```

See `src/README.md` for detailed information about the frontend architecture.

## 🎯 Features

- 🎥 **YouTube Integration:** Paste any YouTube link to start learning
- 🤖 **AI Tutor:** Real-time voice conversation with Gemini Live API
- 📝 **Smart Content:** Auto-generated summaries, topics, and vocabulary
- 🌍 **Multilingual:** Support for 15+ languages
- 📱 **Responsive Design:** Beautiful UI that works on all devices

## 🔒 Security Note

**Your Gemini API key must never be exposed in the React frontend.** This app uses a backend server (`server/index.js`) to:
- Make authenticated calls to Gemini API
- Proxy Live audio over WebSocket
- Keep your API key secure

## 📚 Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, WebSocket (ws)
- **AI:** Google Gemini API (Flash & Live models)
- **Audio:** Web Audio API, PCM16 encoding
