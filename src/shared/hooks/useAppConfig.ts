import { useState, useEffect } from 'react';
import { LANGUAGES } from '../constants';
import { getBackendOrigin } from '../services/backend';

interface AppConfig {
  enabled_target_languages: string[];
  enabled_native_languages: string[];
}

/**
 * Hook to fetch and cache app configuration from the backend API
 * Returns enabled languages based on app config
 */
export function useAppConfig() {
  const [enabledTargetLanguages, setEnabledTargetLanguages] = useState(() => {
    // Default fallback while loading
    return LANGUAGES.filter(l =>
      ['English', 'Chinese'].some(code => l.code.startsWith(code))
    );
  });
  const [enabledNativeLanguages, setEnabledNativeLanguages] = useState(() => {
    // Default fallback - all languages available for native language
    return LANGUAGES;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchConfig() {
      try {
        const backendOrigin = getBackendOrigin();

        // Fetch both configs in parallel
        const [targetResponse, nativeResponse] = await Promise.all([
          fetch(`${backendOrigin}/api/config/enabled_target_languages`),
          fetch(`${backendOrigin}/api/config/enabled_native_languages`)
        ]);

        if (targetResponse.ok) {
          const enabledTargetLangs = await targetResponse.json();
          if (isMounted && enabledTargetLangs && Array.isArray(enabledTargetLangs)) {
            const filtered = LANGUAGES.filter(l =>
              enabledTargetLangs.some(code => l.code.startsWith(code))
            );
            setEnabledTargetLanguages(filtered);
          }
        }

        if (nativeResponse.ok) {
          const enabledNativeLangs = await nativeResponse.json();
          if (isMounted && enabledNativeLangs && Array.isArray(enabledNativeLangs)) {
            const filtered = LANGUAGES.filter(l =>
              enabledNativeLangs.some(code => l.code.startsWith(code))
            );
            setEnabledNativeLanguages(filtered);
          }
        }
      } catch (error) {
        console.error('Error fetching app config:', error);
        // Keep default fallback on error
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    enabledTargetLanguages,
    enabledNativeLanguages,
    // Backwards compatibility - keep old name pointing to target languages
    enabledLanguages: enabledTargetLanguages,
    isLoading
  };
}

/**
 * Fetch app config once and cache it
 * Use this for non-React contexts
 */
let cachedConfig: AppConfig | null = null;
let configPromise: Promise<AppConfig> | null = null;

export async function fetchAppConfig(): Promise<AppConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing promise if fetch is in progress
  if (configPromise) {
    return configPromise;
  }

  // Start new fetch
  configPromise = (async () => {
    try {
      const backendOrigin = getBackendOrigin();

      // Fetch both configs in parallel
      const [targetResponse, nativeResponse] = await Promise.all([
        fetch(`${backendOrigin}/api/config/enabled_target_languages`),
        fetch(`${backendOrigin}/api/config/enabled_native_languages`)
      ]);

      const enabledTargetLangs = targetResponse.ok
        ? await targetResponse.json()
        : ['English', 'Chinese'];

      const enabledNativeLangs = nativeResponse.ok
        ? await nativeResponse.json()
        : LANGUAGES.map(l => l.code);

      cachedConfig = {
        enabled_target_languages: enabledTargetLangs,
        enabled_native_languages: enabledNativeLangs
      };

      return cachedConfig;
    } catch (error) {
      console.error('Error fetching app config:', error);
      // Return default on error
      cachedConfig = {
        enabled_target_languages: ['English', 'Chinese'],
        enabled_native_languages: LANGUAGES.map(l => l.code)
      };
      return cachedConfig;
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
}

/**
 * Get enabled languages from cached config
 */
export function getEnabledLanguages() {
  if (!cachedConfig) {
    // Return default if not loaded yet
    return LANGUAGES.filter(l =>
      ['English', 'Chinese'].some(code => l.code.startsWith(code))
    );
  }

  return LANGUAGES.filter(l =>
    cachedConfig.enabled_target_languages.some(code => l.code.startsWith(code))
  );
}
