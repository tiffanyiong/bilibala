import React from 'react';
import { MutedIcon, MicIcon, CallEndIcon, LifebuoyIcon } from './icons/LiveIcons';

interface ControlBarProps {
  isConnected: boolean;
  isMuted: boolean;
  isHintsLoading: boolean;
  onToggleMute: () => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onManualHint: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  isConnected,
  isMuted,
  isHintsLoading,
  onToggleMute,
  onStartSession,
  onStopSession,
  onManualHint,
}) => {
  return (
    <footer className="w-full h-auto px-6 pb-6 pt-2 z-20 shrink-0 flex items-end justify-center">
        <div className="flex flex-row items-end justify-center gap-4 md:gap-8 w-full mx-auto max-w-md">
            
            {/* Left: Mute */}
            <button 
            onClick={onToggleMute}
            disabled={!isConnected}
            className="flex flex-col items-center gap-2 group"
            >
            <div className={`w-12 h-12 rounded-full shadow-md border-2 border-white flex items-center justify-center transition-all group-active:scale-95 ${
                isMuted 
                ? 'bg-red-50 text-red-500 shadow-red-100' 
                : 'bg-white text-slate-400 hover:bg-slate-50'
            }`}>
                <span className="material-icons-round text-xl group-hover:text-slate-600 transition-colors scale-90">
                    {isMuted ? <MutedIcon /> : <MicIcon />}
                </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Mute</span>
            </button>

            {/* Center: Main Action (Start/End) */}
            {!isConnected ? (
                <button 
                onClick={onStartSession}
                className="flex flex-col items-center gap-2 group"
                >
                <div className="w-16 h-16 bg-green-500 hover:bg-green-400 text-white rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transform transition-all active:scale-95 border-4 border-white/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50"></div>
                    <MicIcon />
                </div>
                <span className="text-[10px] font-bold text-slate-400">Start</span>
                </button>
            ) : (
                <button 
                onClick={onStopSession}
                className="flex flex-col items-center gap-2 group"
                >
                <div className="w-16 h-16 bg-red-500 hover:bg-red-400 text-white rounded-full shadow-lg shadow-red-500/30 flex items-center justify-center transform transition-all active:scale-95 border-4 border-white/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50"></div>
                    <CallEndIcon />
                </div>
                <span className="text-[10px] font-bold text-slate-400">End</span>
                </button>
            )}

            {/* Right: Rescue Ring (Hint) */}
            <button 
            onClick={onManualHint}
            disabled={!isConnected || isHintsLoading}
            className="flex flex-col items-center gap-2 group"
            >
            <div className={`w-12 h-12 rounded-full shadow-md border-2 border-white flex items-center justify-center transition-all group-active:scale-95 ${
                isHintsLoading
                ? 'bg-yellow-100 text-yellow-600 animate-spin border-yellow-200' 
                : 'bg-white text-yellow-500 hover:bg-yellow-50'
            }`}>
                <div className="scale-90">
                    <LifebuoyIcon />
                </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Help</span>
            </button>

        </div>
    </footer>
  );
};

export default ControlBar;
