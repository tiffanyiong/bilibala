<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/13lr0mWX_h8UJHtvB60R2XZ4_HGqeCyPt

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `server/.env` (you can copy from `server/env.example`) and add:
   - `GEMINI_API_KEY=YOUR_KEY`
   - Optional: `GEMINI_API_VERSION=v1alpha` (some Live setups require this)
   - Optional: `GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025`

3. Run the backend (Terminal 1):
   `npm run dev:server`

4. Run the React app (Terminal 2):
   `npm run dev`

Security note: **Your Gemini API key must never be exposed in React.** This app uses a backend (`server/index.js`) to call Gemini and proxies Live audio over WebSocket.
