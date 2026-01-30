import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';

// Import configuration
import { config } from './config/env.js';

// Import routes
import videoRoutes from './routes/videoRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import speechRoutes from './routes/speechRoutes.js';
import translationRoutes from './routes/translationRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';

// Import WebSocket handler
import { setupLiveWebSocket } from './websocket/liveHandler.js';

// Import config service
import { startConfigRefresh } from './services/configService.js';

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

// Start server
server.listen(config.server.port, config.server.host, () => {
  console.log(`Bilibala server listening on http://${config.server.host}:${config.server.port}`);
  console.log(`(Allowed for 0.0.0.0: accepting external connections)`);
});
