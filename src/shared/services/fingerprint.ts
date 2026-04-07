import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprint: string | null = null;

const STORAGE_KEY = 'bilibala_device_id';

export async function getFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  // Return persisted fingerprint if available — prevents instability across page reloads
  // Only reuse non-fallback IDs (fallback_ prefix = FingerprintJS previously failed)
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && !stored.startsWith('fallback_')) {
    cachedFingerprint = stored;
    return stored;
  }

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFingerprint = result.visitorId;
    localStorage.setItem(STORAGE_KEY, result.visitorId);
    return result.visitorId;
  } catch (error) {
    console.error('Fingerprint generation failed', error);
    // Fallback for blockers/privacy mode — reuse existing fallback if present
    let fallback = localStorage.getItem(STORAGE_KEY);
    if (!fallback || !fallback.startsWith('fallback_')) {
      fallback = 'fallback_' + crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, fallback);
    }
    cachedFingerprint = fallback;
    return fallback;
  }
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}