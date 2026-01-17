import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprint: string | null = null;

export async function getFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFingerprint = result.visitorId;
    return result.visitorId;
  } catch (error) {
    console.error('Fingerprint generation failed', error);
    // Fallback for blockers/privacy mode
    let fallback = localStorage.getItem('bilibala_device_id');
    if (!fallback) {
        fallback = 'fallback_' + crypto.randomUUID();
        localStorage.setItem('bilibala_device_id', fallback);
    }
    return fallback;
  }
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}