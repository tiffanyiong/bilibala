import { Modality } from '@google/genai';
import { createAi } from '../services/geminiService.js';
import { buildSystemInstruction } from '../utils/helpers.js';
import { config } from '../config/env.js';
import { supabaseAdmin } from '../services/supabaseAdmin.js';
import { getConfigNumber } from '../services/configService.js';

/**
 * Record AI tutor usage: audit log + split between monthly allowance and credits.
 * Monthly column only tracks usage covered by the monthly allowance.
 * Anything beyond is deducted from purchased credits.
 */
async function recordTutorUsage(userId, minutesUsed) {
  if (!supabaseAdmin || !userId) return;
  try {
    // 1. Audit log
    await supabaseAdmin.from('usage_history').insert({
      user_id: userId,
      action_type: 'ai_tutor',
      metadata: { minutes_used: minutesUsed },
    });

    // 2. Get user's tier, credits, and current monthly usage
    const { data: sub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('tier, ai_tutor_credit_minutes, ai_tutor_monthly_minutes_used')
      .eq('user_id', userId)
      .single();

    if (!sub) return;

    const monthlyLimit = sub.tier === 'pro' ? getConfigNumber('ai_tutor_monthly_max_minutes', 60) : 0;
    const currentUsed = sub.ai_tutor_monthly_minutes_used || 0;
    const monthlyRemaining = Math.max(0, monthlyLimit - currentUsed);

    // 3. Split between monthly allowance and credits
    const monthlyPortion = Math.min(minutesUsed, monthlyRemaining);
    const creditPortion = minutesUsed - monthlyPortion;

    console.log(`[server] AI tutor usage split for user ${userId}: ${minutesUsed} min total, ${monthlyPortion} monthly, ${creditPortion} credits`);

    // 4. Increment monthly column only for the monthly-covered portion
    if (monthlyPortion > 0) {
      await supabaseAdmin.rpc('increment_monthly_usage', {
        p_user_id: userId,
        p_action_type: 'ai_tutor',
        p_amount: monthlyPortion,
      });
    }

    // 5. Deduct the rest from credits
    if (creditPortion > 0 && sub.ai_tutor_credit_minutes > 0) {
      const { data: deducted } = await supabaseAdmin.rpc('deduct_ai_tutor_credits', {
        p_user_id: userId,
        p_minutes: creditPortion,
      });
      console.log(`[server] Deducted ${deducted} AI tutor credit minutes for user ${userId}`);
    }
  } catch (err) {
    console.error('[server] Failed to record tutor usage:', err.message);
  }
}

/**
 * Get user's AI tutor minutes used this month.
 */
async function getMonthlyMinutesUsed(userId) {
  if (!supabaseAdmin || !userId) return 0;
  try {
    const { data, error } = await supabaseAdmin.rpc('get_current_monthly_usage', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data?.[0]?.ai_tutor_minutes_used ?? 0;
  } catch (err) {
    console.error('[server] Failed to get monthly usage:', err.message);
    return 0;
  }
}

/**
 * Sets up WebSocket connection handler for Gemini Live sessions
 * @param {WebSocketServer} wss - The WebSocket server instance
 */
export function setupLiveWebSocket(wss) {
  wss.on('connection', (ws) => {
    console.log('[server] WS /live connected');
    let session = null;
    let isClosed = false;
    let isStarting = false;
    const pendingAudio = [];
    let lastStartPayload = null;

    // Session timing
    let sessionStartTime = null;
    let sessionUserId = null;
    let warningTimer = null;
    let limitTimer = null;

    const send = (obj) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify(obj));
    };

    const clearTimers = () => {
      if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
      if (limitTimer) { clearTimeout(limitTimer); limitTimer = null; }
    };

    let usageRecorded = false;

    const endSession = async (reason) => {
      clearTimers();
      const durationSeconds = sessionStartTime
        ? Math.floor((Date.now() - sessionStartTime) / 1000)
        : 0;
      const minutesUsed = Math.max(1, Math.ceil(durationSeconds / 60));

      // Record usage server-side (only once per session)
      if (sessionUserId && durationSeconds > 0 && !usageRecorded) {
        usageRecorded = true;
        await recordTutorUsage(sessionUserId, minutesUsed);
      }

      // Close Gemini session
      try { session?.close(); } catch {}
      session = null;
      sessionStartTime = null;

      return { durationSeconds, minutesUsed };
    };

    const closeWith = async (code, message) => {
      if (isClosed) return;
      isClosed = true;
      await endSession('close');
      try {
        ws.close(code, message);
      } catch {}
    };

    ws.on('message', async (raw, isBinary) => {
      try {
        console.log('[server] WS message received', {
          isBinary: !!isBinary,
          type: typeof raw,
          bytes: typeof raw === 'string' ? raw.length : (raw?.length ?? raw?.byteLength ?? null),
        });

        if (isBinary) {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          if (!session) {
            if (isStarting) {
              pendingAudio.push(buf);
              if (pendingAudio.length > 50) pendingAudio.shift();
              return;
            }
            return send({ type: 'error', error: 'Need start payload before audio (no session). Click Start again after refresh.' });
          }
          session.sendRealtimeInput({
            audio: { data: buf.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
          });
          return;
        }

        const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
        const msg = JSON.parse(text);
        console.log('[server] WS message', msg?.type);

        if (msg.type === 'start') {
          if (session || isStarting) {
            send({ type: 'status', status: 'connected' });
            return;
          }
          console.log('[server] starting Gemini Live session');
          isStarting = true;
          lastStartPayload = msg.payload || null;

          // Extract userId from payload
          sessionUserId = lastStartPayload?.userId || null;

          console.log('[server] start payload received', {
            userId: sessionUserId,
            hasTitle: !!lastStartPayload?.videoTitle,
            hasSummary: !!lastStartPayload?.summary,
            vocabCount: Array.isArray(lastStartPayload?.vocabulary) ? lastStartPayload.vocabulary.length : 0,
            transcriptCount: Array.isArray(lastStartPayload?.transcript) ? lastStartPayload.transcript.length : 0,
            nativeLang: lastStartPayload?.nativeLang,
            targetLang: lastStartPayload?.targetLang,
            level: lastStartPayload?.level,
          });

          if (!config.gemini.apiKey) {
            send({ type: 'error', error: 'Server missing GEMINI_API_KEY' });
            return closeWith(1011, 'server missing api key');
          }

          // --- Server-side limit enforcement ---
          const sessionMaxMinutes = getConfigNumber('ai_tutor_session_max_minutes', 40);
          const monthlyMaxMinutes = getConfigNumber('ai_tutor_monthly_max_minutes', 60);
          const warningBeforeEnd = getConfigNumber('ai_tutor_warning_before_end_seconds', 60);

          let effectiveMaxSeconds = sessionMaxMinutes * 60;

          if (sessionUserId) {
            // Get user's tier and credits
            const { data: sub } = await supabaseAdmin
              .from('user_subscriptions')
              .select('tier, ai_tutor_credit_minutes')
              .eq('user_id', sessionUserId)
              .single();

            // Free users: 0 monthly allowance, only credits
            // Pro users: 60 min monthly allowance + credits
            const userMonthlyLimit = sub?.tier === 'pro' ? monthlyMaxMinutes : 0;

            let monthlyRemainingSeconds = 0;
            if (userMonthlyLimit > 0) {
              const minutesUsed = await getMonthlyMinutesUsed(sessionUserId);
              monthlyRemainingSeconds = Math.max(0, (userMonthlyLimit - minutesUsed) * 60);
            }

            const creditSeconds = (sub?.ai_tutor_credit_minutes || 0) * 60;
            const totalRemainingSeconds = monthlyRemainingSeconds + creditSeconds;

            console.log(`[server] User ${sessionUserId} (${sub?.tier || 'unknown'}): monthly limit ${userMonthlyLimit} min, ${Math.floor(monthlyRemainingSeconds / 60)} min monthly remaining, ${Math.floor(creditSeconds / 60)} min credits, ${Math.floor(totalRemainingSeconds / 60)} min total`);

            if (totalRemainingSeconds <= 0) {
              send({ type: 'error', error: 'AI tutor limit reached. Please purchase credits or upgrade to Pro.' });
              isStarting = false;
              return closeWith(1000, 'no time remaining');
            }

            effectiveMaxSeconds = Math.min(effectiveMaxSeconds, totalRemainingSeconds);
          }

          console.log(`[server] Session cap: ${effectiveMaxSeconds} seconds`);

          const ai = createAi();
          const systemInstruction = buildSystemInstruction(msg.payload || {});

          send({ type: 'status', status: 'connecting' });

          session = await ai.live.connect({
            model: config.gemini.liveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
              },
              // Configure VAD to prevent premature turn completion in Chinese
              // Use LOW end-of-speech sensitivity so the AI completes full sentences
              realtimeInputConfig: {
                automaticActivityDetection: {
                  endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
                  startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                  // Longer silence before considering speech ended (helps with Chinese pauses)
                  silenceDurationMs: 1500, // 1.5 seconds instead of default
                }
              },
              systemInstruction,
            },
            callbacks: {
              onopen: () => {
                console.log('[server] Gemini Live connected');
                send({ type: 'status', status: 'connected' });
              },
              onmessage: (m) => {
                if (m?.setupComplete) console.log('[server] Gemini setupComplete');
                send({
                  type: 'live',
                  setupComplete: m.setupComplete ?? null,
                  serverContent: m.serverContent ?? null,
                  toolCall: m.toolCall ?? null,
                  toolCallCancellation: m.toolCallCancellation ?? null,
                  usageMetadata: m.usageMetadata ?? null,
                  goAway: m.goAway ?? null,
                  sessionResumptionUpdate: m.sessionResumptionUpdate ?? null,
                  voiceActivityDetectionSignal: m.voiceActivityDetectionSignal ?? null,
                  text: m.text ?? null,
                  data: m.data ?? null,
                });
              },
              onerror: (e) => {
                console.log('[server] Gemini Live error', e?.message || e);
                send({ type: 'error', error: e?.message || 'live error' });
              },
              onclose: (e) => {
                console.log('[server] Gemini Live closed', e?.code, e?.reason);
                send({ type: 'status', status: 'closed', code: e?.code, reason: e?.reason });
              },
            },
          });
          isStarting = false;
          sessionStartTime = Date.now();

          // --- Set enforcement timers ---
          // Warning timer
          const warningDelay = (effectiveMaxSeconds - warningBeforeEnd) * 1000;
          if (warningDelay > 0) {
            warningTimer = setTimeout(() => {
              send({ type: 'time_warning', secondsLeft: warningBeforeEnd });
              console.log(`[server] Sent time_warning: ${warningBeforeEnd}s remaining`);
            }, warningDelay);
          }

          // Limit timer — forcefully end session
          limitTimer = setTimeout(async () => {
            const reason = sessionUserId
              ? (effectiveMaxSeconds < sessionMaxMinutes * 60 ? 'monthly' : 'session')
              : 'session';
            const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

            send({ type: 'session_limit', reason, durationSeconds });
            console.log(`[server] Session limit reached (${reason}) after ${durationSeconds}s`);

            await closeWith(1000, `${reason} limit reached`);
          }, effectiveMaxSeconds * 1000);

          // Flush queued audio
          if (pendingAudio.length) {
            console.log('[server] flushing queued audio', pendingAudio.length);
            while (pendingAudio.length) {
              const chunk = pendingAudio.shift();
              try {
                session.sendRealtimeInput({
                  audio: { data: chunk.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
                });
              } catch {}
            }
          }

          // Force an initial turn with minimal greeting only.
          try {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: 'Just say hi briefly, then wait for me to speak.' }],
                },
              ],
              turnComplete: true,
            });
          } catch (e) {
            console.warn('failed to send initial clientContent', e);
          }

          return;
        }

        if (!session) return send({ type: 'error', error: 'Live session not started yet' });

        if (msg.type === 'text') {
          const { text } = msg.payload || {};
          if (!text) return;
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text }] }],
            turnComplete: true,
          });
          return;
        }

        if (msg.type === 'stop') {
          isClosed = true;
          await endSession('manual_stop');
          try { ws.close(1000, 'stopped'); } catch {}
          return;
        }
      } catch (err) {
        console.error('ws message error', err);
        send({ type: 'error', error: 'Invalid message' });
      }
    });

    ws.on('error', (e) => {
      console.log('[server] WS client error', e?.message || e);
    });

    ws.on('close', async () => {
      console.log('[server] WS /live closed');
      if (!isClosed) {
        isClosed = true;
        await endSession('disconnect');
      }
    });
  });
}
