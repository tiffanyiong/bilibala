import cors from 'cors';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

// Import configuration
import { config } from './config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// Import routes
import videoRoutes from './routes/videoRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import speechRoutes from './routes/speechRoutes.js';
import translationRoutes from './routes/translationRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import deeplRoutes from './routes/deeplRoutes.js';
import exploreRoutes from './routes/exploreRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import configRoutes from './routes/configRoutes.js';

// Import WebSocket handler
import { setupLiveWebSocket } from './websocket/liveHandler.js';

// Import config service
import { startConfigRefresh } from './services/configService.js';
import { startStripeCleanup } from './services/stripeCleanup.js';

// Create Express app
const app = express();

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use(express.json({ limit: '50mb' }));
app.use(cors({ origin: true, credentials: true }));

// Health check endpoint
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Mount API routes
app.use('/api', videoRoutes);
app.use('/api', conversationRoutes);
app.use('/api', speechRoutes);
app.use('/api', translationRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', deeplRoutes);
app.use('/api', exploreRoutes);
app.use('/api', sessionRoutes);
app.use('/api', configRoutes);

// Serve static files in production (Vite build output)
if (isProduction) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/live' });

// Error handling for servers
server.on('error', (err) => {
  console.error('HTTP server error:', err);
});

wss.on('error', (err) => {
  console.error('WebSocket server error:', err);
});

// Setup WebSocket connection handler
setupLiveWebSocket(wss);

// Start config refresh (loads from DB, refreshes every 5 min)
startConfigRefresh();

// Start Stripe cleanup cron (cancels subscriptions for deleted users, runs every 5 min)
startStripeCleanup();

// Start server
server.listen(config.server.port, config.server.host, () => {
  console.log(`Bilibala server listening on http://${config.server.host}:${config.server.port}`);
  console.log(`(Allowed for 0.0.0.0: accepting external connections)`);
});
