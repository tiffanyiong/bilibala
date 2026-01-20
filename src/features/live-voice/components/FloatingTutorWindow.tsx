import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VocabularyItem } from '../../../shared/types';
import { useLiveVoice } from '../hooks/useLiveVoice';
import ControlBar from '../../../shared/components/ControlBar';
import StatusPill from '../../../shared/components/StatusPill';
import Transcript from '../../chat/components/Transcript';
import DuckAvatar from './DuckAvatar';
import RescueRing from './RescueRing';

type WindowState = 'closed' | 'minimized' | 'expanded';

interface FloatingTutorWindowProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  summary: string;
  vocabulary: VocabularyItem[];
  nativeLang: string;
  targetLang: string;
  level: string;
}

// Icons
const MinimizeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DuckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 55C25 40 35 25 55 25C70 25 80 35 80 45C80 50 85 50 90 45C95 40 98 45 95 55C92 65 85 85 55 85C35 85 25 75 25 55Z" fill="#FCD34D" />
    <path d="M45 60C45 60 55 50 70 60" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M25 45H15C10 45 10 55 15 55H25" fill="#F97316"/>
    <circle cx="45" cy="40" r="4" fill="#1F2937"/>
  </svg>
);

const FloatingTutorWindow: React.FC<FloatingTutorWindowProps> = ({
  isOpen,
  onClose,
  videoTitle,
  summary,
  vocabulary,
  nativeLang,
  targetLang,
  level,
}) => {
  const [windowState, setWindowState] = useState<WindowState>('expanded');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 400, height: 560 });

  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });

  const liveVoice = useLiveVoice({
    videoTitle,
    summary,
    vocabulary,
    nativeLang,
    targetLang,
    level,
  });

  // Calculate responsive window size
  const calculateWindowSize = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Base sizes
    const baseWidth = 400;
    const baseHeight = 560;

    // Max sizes (with margins)
    const maxWidth = Math.min(baseWidth, viewportWidth - 64); // 32px margin on each side
    const maxHeight = Math.min(baseHeight, viewportHeight - 120); // 80px top + 40px bottom margin

    // Min sizes
    const minWidth = 320;
    const minHeight = 400;

    return {
      width: Math.max(minWidth, maxWidth),
      height: Math.max(minHeight, maxHeight),
    };
  }, []);

  // Check if mobile and handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Update responsive window size
      const newSize = calculateWindowSize();
      setWindowSize(newSize);

      // Always anchor expanded window to bottom-right corner when resizing
      if (!mobile && isOpen && windowState === 'expanded') {
        const newX = window.innerWidth - newSize.width - 32;
        const newY = window.innerHeight - newSize.height - 32;

        const constrainedX = Math.max(32, newX);
        const constrainedY = Math.max(100, newY);

        positionRef.current = { x: constrainedX, y: constrainedY };
        setPosition({ x: constrainedX, y: constrainedY });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, windowState, calculateWindowSize]);

  // Initialize position and state when opening (only on isOpen change)
  useEffect(() => {
    if (isOpen) {
      // Set to expanded when first opened
      setWindowState('expanded');

      // Calculate initial size and position for desktop
      const mobile = window.innerWidth < 768;
      if (!mobile) {
        const size = calculateWindowSize();
        setWindowSize(size);

        // Position at bottom-right with some margin
        const initialX = window.innerWidth - size.width - 32; // 32px margin from right
        const initialY = window.innerHeight - size.height - 32; // height + 32px margin from bottom
        setPosition({ x: Math.max(32, initialX), y: Math.max(100, initialY) });
        positionRef.current = { x: Math.max(32, initialX), y: Math.max(100, initialY) };
      }
    }
  }, [isOpen, calculateWindowSize]);

  // Dragging handlers (desktop/tablet only)
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile) return;

    e.preventDefault();
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      x: clientX - positionRef.current.x,
      y: clientY - positionRef.current.y,
    };
  }, [isMobile]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || isMobile) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragStartRef.current.x;
    const newY = clientY - dragStartRef.current.y;

    // Constrain to viewport
    const maxX = window.innerWidth - 420;
    const maxY = window.innerHeight - 100;

    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(80, Math.min(newY, maxY)); // 80px for header

    positionRef.current = { x: constrainedX, y: constrainedY };
    setPosition({ x: constrainedX, y: constrainedY });
  }, [isDragging, isMobile]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleClose = () => {
    liveVoice.stopSession();
    onClose();
  };

  const handleMinimize = () => {
    setWindowState('minimized');
  };

  const handleExpand = () => {
    setWindowState('expanded');
  };

  if (!isOpen) return null;

  // Minimized view - just a pill bar (always bottom-right)
  if (windowState === 'minimized') {
    return (
      <div
        ref={windowRef}
        className="fixed z-[150] bottom-8 right-8"
      >
        <div className="bg-[#FAF9F6] border border-stone-200 rounded-full shadow-lg px-4 py-2 flex items-center gap-3">
          <div className="w-6 h-6 shrink-0">
            <DuckIcon />
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-stone-700 truncate">AI Tutor</span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${liveVoice.isConnected ? 'bg-green-500 animate-pulse' : 'bg-stone-300'}`} />
            <span className="text-xs text-stone-500 tabular-nums">
              {liveVoice.formatDuration(liveVoice.durationSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleExpand}
              className="p-1.5 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
              aria-label="Expand"
            >
              <ExpandIcon />
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view - full floating window
  return (
    <div
      ref={windowRef}
      className={`fixed z-[150] ${
        isMobile ? 'inset-4 top-20' : ''
      } flex flex-col bg-[#FAF9F6] rounded-2xl border border-stone-200 shadow-2xl overflow-hidden`}
      style={isMobile ? {} : {
        left: position.x,
        top: position.y,
        width: windowSize.width,
        height: windowSize.height,
        transition: isDragging ? 'none' : 'all 0.2s ease'
      }}
    >
      {/* Header with drag handle */}
      <div
        className={`shrink-0 px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-[#FAF9F6] ${
          !isMobile ? 'cursor-move' : ''
        }`}
        onMouseDown={!isMobile ? handleDragStart : undefined}
        onTouchStart={!isMobile ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 shrink-0">
            <DuckIcon />
          </div>
          <span className="text-sm font-semibold text-stone-700">AI Tutor</span>
          <span className={`w-1.5 h-1.5 rounded-full ${liveVoice.isConnected ? 'bg-green-500 animate-pulse' : 'bg-stone-300'}`} />
          <span className="text-xs text-stone-500 tabular-nums">
            {liveVoice.formatDuration(liveVoice.durationSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="p-1.5 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
            aria-label="Minimize"
          >
            <MinimizeIcon />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

        {/* Avatar Area */}
        <div className={`${liveVoice.isActiveSession ? 'shrink-0 py-3' : 'flex-1 flex flex-col items-center justify-center'} relative w-full min-h-[120px] ${liveVoice.hints.length > 0 ? 'z-[70]' : 'z-10'}`}>

          {liveVoice.hints.length > 0 ? (
            <RescueRing hints={liveVoice.hints} onClose={liveVoice.clearHints} />
          ) : (
            <>
              <div className="relative w-full max-w-[200px] mx-auto flex justify-center items-center">
                <div className="w-20 h-20 relative z-10 transition-all">
                  <DuckAvatar />
                </div>
              </div>

              <div className="min-h-[1.5rem] mt-2 flex items-center justify-center relative z-20 px-4">
                {liveVoice.callEnded ? (
                  <div className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-zinc-50 text-zinc-600 border border-zinc-200 shadow-sm flex items-center gap-2">
                    <span>{liveVoice.callEndedNote}</span>
                  </div>
                ) : liveVoice.isIdle ? null : (
                  <StatusPill
                    isConnected={liveVoice.isConnected}
                    isAiSpeaking={liveVoice.isAiSpeaking}
                    isAiThinking={liveVoice.isAiThinking}
                    realtimeInput={liveVoice.realtimeInput}
                    error={liveVoice.error}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Transcript (shown when connected) */}
        {liveVoice.isActiveSession && (
          <div className="flex-1 min-h-0 px-3 pb-2 overflow-hidden">
            <Transcript
              history={liveVoice.history}
              realtimeInput={liveVoice.realtimeInput}
              realtimeOutput={liveVoice.realtimeOutput}
              isConnected={liveVoice.isConnected}
              messagesEndRef={liveVoice.messagesEndRef}
            />
          </div>
        )}

        {/* Tap to start text */}
        {(liveVoice.isIdle || liveVoice.callEnded) && (
          <div className="text-center pb-2 text-zinc-400 font-medium animate-pulse text-xs">
            Tap Start to chat
          </div>
        )}

        {/* Control Bar */}
        <div className="shrink-0">
          <ControlBar
            isConnected={liveVoice.isConnected}
            isMuted={liveVoice.isMuted}
            isHintsLoading={liveVoice.isHintsLoading}
            onToggleMute={liveVoice.toggleMute}
            onStartSession={liveVoice.startSession}
            onStopSession={liveVoice.stopSession}
            onManualHint={liveVoice.requestHint}
          />
        </div>
      </div>
    </div>
  );
};

export default FloatingTutorWindow;
