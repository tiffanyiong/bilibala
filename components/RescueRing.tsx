import React from 'react';
import { LifebuoyIcon } from './icons/LiveIcons';

interface RescueRingProps {
  hints: string[];
  onClose: () => void;
}

const RescueRing: React.FC<RescueRingProps> = ({ hints, onClose }) => {
  return (
    <div className="w-full max-w-md mx-auto px-4 relative z-[100] animate-fadeIn">
        <div className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border-4 border-yellow-300 text-center relative">
            <button 
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <h4 className="text-xs font-black text-yellow-600 uppercase mb-3 tracking-wider flex items-center justify-center gap-2">
            <LifebuoyIcon /> Rescue Ring
            </h4>
            <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1 scrollbar-hide">
                {hints.map((hint, i) => (
                    <div key={i} className="p-3 bg-yellow-50 rounded-xl text-sm font-bold text-slate-700 border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors text-left" onClick={onClose}>
                        "{hint}"
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default RescueRing;
