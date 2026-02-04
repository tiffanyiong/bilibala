import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBackendOrigin } from '../../../shared/services/backend';

const MAX_CHARS = 200; // Max characters allowed for translation

// Localized error messages keyed by language name
const ERROR_MESSAGES: Record<string, { notAvailable: string; tooLong: string }> = {
  'Chinese (Mandarin - 中文)': { notAvailable: '翻译暂时不可用', tooLong: '选择的文字过长' },
  'Chinese (Cantonese - 粵語)': { notAvailable: '翻譯暫時唔可用', tooLong: '揀選嘅文字太長' },
  'Japanese (日本語)': { notAvailable: '翻訳は現在利用できません', tooLong: '選択テキストが長すぎます' },
  'Korean (한국어)': { notAvailable: '번역을 현재 사용할 수 없습니다', tooLong: '선택한 텍스트가 너무 깁니다' },
  'Spanish (Español)': { notAvailable: 'Traducción no disponible', tooLong: 'Selección demasiado larga' },
  'French (Français)': { notAvailable: 'Traduction indisponible', tooLong: 'Sélection trop longue' },
  'German (Deutsch)': { notAvailable: 'Übersetzung nicht verfügbar', tooLong: 'Auswahl zu lang' },
  'Portuguese (Português)': { notAvailable: 'Tradução indisponível', tooLong: 'Seleção muito longa' },
  'Russian (Русский)': { notAvailable: 'Перевод временно недоступен', tooLong: 'Выделение слишком длинное' },
  'Italian (Italiano)': { notAvailable: 'Traduzione non disponibile', tooLong: 'Selezione troppo lunga' },
};

const DEFAULT_ERRORS = { notAvailable: 'Translation is currently not available', tooLong: 'Selection too long' };

interface TranslationPopupProps {
  sourceLang?: string; // e.g., "English" - optional, DeepL auto-detects if not provided
  targetLang: string; // e.g., "Chinese (Mandarin - 中文)" - translate TO this language
  containerRef?: React.RefObject<HTMLElement | null>; // Optional container to scope selection
}

interface PopupState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  translation: string | null;
  loading: boolean;
  error: string | null;
}

const TranslationPopup: React.FC<TranslationPopupProps> = ({
  sourceLang,
  targetLang,
  containerRef,
}) => {
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
    translation: null,
    loading: false,
    error: null,
  });

  const popupRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track the last processed text to avoid duplicate triggers
  const lastProcessedTextRef = useRef<string>('');

  // Translate text via backend API
  const translateText = useCallback(async (text: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setPopup(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Build request body - only include sourceLang if explicitly provided
      const requestBody: { text: string; targetLang: string; sourceLang?: string } = {
        text,
        targetLang,
      };
      if (sourceLang) {
        requestBody.sourceLang = sourceLang;
      }

      const response = await fetch(`${getBackendOrigin()}/api/translate/deepl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msgs = ERROR_MESSAGES[targetLang] || DEFAULT_ERRORS;
        if (errorData.code === 'QUOTA_EXCEEDED') {
          throw new Error(msgs.notAvailable);
        }
        if (errorData.code === 'LANGUAGE_NOT_SUPPORTED') {
          throw new Error(msgs.notAvailable);
        }
        throw new Error(errorData.error || msgs.notAvailable);
      }

      const data = await response.json();
      setPopup(prev => ({
        ...prev,
        translation: data.translation,
        loading: false,
      }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const fallback = (ERROR_MESSAGES[targetLang] || DEFAULT_ERRORS).notAvailable;
      setPopup(prev => ({
        ...prev,
        error: err.message || fallback,
        loading: false,
      }));
    }
  }, [sourceLang, targetLang]);

  // Shared selection processing logic (works for both mouse and touch)
  const processSelection = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    // No selection or empty
    if (!selectedText) {
      return;
    }

    // Skip if we already processed this exact text (avoids duplicate triggers)
    if (selectedText === lastProcessedTextRef.current) {
      return;
    }

    // Check if selection is within the container (if specified)
    if (containerRef?.current) {
      const range = selection?.getRangeAt(0);
      if (range && !containerRef.current.contains(range.commonAncestorContainer)) {
        return;
      }
    }

    // Get position from the selection range (works on both desktop and mobile)
    const range = selection?.getRangeAt(0);
    if (!range) return;

    const rect = range.getBoundingClientRect();
    // Position popup above the center of the selection
    const posX = rect.left + rect.width / 2;
    const posY = rect.top;

    lastProcessedTextRef.current = selectedText;

    // Check character limit
    if (selectedText.length > MAX_CHARS) {
      const msgs = ERROR_MESSAGES[targetLang] || DEFAULT_ERRORS;
      setPopup({
        visible: true,
        x: posX,
        y: posY,
        text: selectedText,
        translation: null,
        loading: false,
        error: `${msgs.tooLong} (${selectedText.length}/${MAX_CHARS})`,
      });
      return;
    }

    // Only skip translation if BOTH sourceLang is explicitly provided AND it matches targetLang
    // If sourceLang is undefined, let DeepL auto-detect the source language
    if (sourceLang && sourceLang === targetLang) {
      return;
    }

    // Show popup and start translation
    setPopup({
      visible: true,
      x: posX,
      y: posY,
      text: selectedText,
      translation: null,
      loading: true,
      error: null,
    });

    translateText(selectedText);
  }, [containerRef, sourceLang, targetLang, translateText]);

  // Desktop: handle mouseup
  const handleMouseUp = useCallback(() => {
    setTimeout(processSelection, 10);
  }, [processSelection]);

  // Mobile/Tablet: handle touchend
  // On touch devices, users long-press to select text, then the selection
  // is finalized on touchend. We use a longer delay to let the OS finish.
  const handleTouchEnd = useCallback(() => {
    setTimeout(processSelection, 300);
  }, [processSelection]);

  // Dismiss popup on outside click/tap
  const handleDismiss = useCallback((event: Event) => {
    if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
      setPopup(prev => ({ ...prev, visible: false }));
      lastProcessedTextRef.current = '';
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  // Hide popup on escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setPopup(prev => ({ ...prev, visible: false }));
      lastProcessedTextRef.current = '';
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  // Set up event listeners for both desktop and mobile
  useEffect(() => {
    const target = containerRef?.current || document;

    // Desktop events
    target.addEventListener('mouseup', handleMouseUp as EventListener);
    // Mobile/Tablet events
    target.addEventListener('touchend', handleTouchEnd as EventListener);

    // Dismiss events (both desktop and mobile)
    document.addEventListener('mousedown', handleDismiss);
    document.addEventListener('touchstart', handleDismiss);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      target.removeEventListener('mouseup', handleMouseUp as EventListener);
      target.removeEventListener('touchend', handleTouchEnd as EventListener);
      document.removeEventListener('mousedown', handleDismiss);
      document.removeEventListener('touchstart', handleDismiss);
      document.removeEventListener('keydown', handleKeyDown);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [containerRef, handleMouseUp, handleTouchEnd, handleDismiss, handleKeyDown]);

  // Adjust popup position to stay within viewport
  useEffect(() => {
    if (popup.visible && popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      let adjustedX = popup.x;
      let adjustedY = popup.y;

      // Adjust horizontal position
      if (popup.x + rect.width / 2 > viewportWidth - 16) {
        adjustedX = viewportWidth - rect.width / 2 - 16;
      }
      if (popup.x - rect.width / 2 < 16) {
        adjustedX = rect.width / 2 + 16;
      }

      // Adjust vertical position (show below if not enough space above)
      if (popup.y - rect.height - 8 < 16) {
        adjustedY = popup.y + 30; // Show below selection
      }

      if (adjustedX !== popup.x || adjustedY !== popup.y) {
        setPopup(prev => ({ ...prev, x: adjustedX, y: adjustedY }));
      }
    }
  }, [popup.visible, popup.x, popup.y]);

  if (!popup.visible) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-[1000] transform -translate-x-1/2 -translate-y-full"
      style={{ left: popup.x, top: popup.y }}
    >
      <div className="bg-stone-900 text-white rounded-lg shadow-xl px-4 py-3 max-w-xs animate-in fade-in zoom-in-95 duration-150">
        {/* Loading state */}
        {popup.loading && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm text-stone-300">Translating...</span>
          </div>
        )}

        {/* Error state */}
        {popup.error && (
          <div className="text-sm text-red-400">{popup.error}</div>
        )}

        {/* Translation result */}
        {popup.translation && !popup.loading && !popup.error && (
          <div className="space-y-1">
            <p className="text-sm font-medium">{popup.translation}</p>
            <p className="text-xs text-stone-400 truncate max-w-[200px]">
              {popup.text}
            </p>
          </div>
        )}

        {/* Arrow pointing down */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-stone-900" />
      </div>
    </div>
  );
};

export default TranslationPopup;
