import React from 'react';
import { HistoryItem } from '../../../shared/types';
import { BotIcon } from '../../../shared/components/icons/LiveIcons';

interface TranscriptProps {
  history: HistoryItem[];
  realtimeInput: string;
  realtimeOutput: string;
  isConnected: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const Transcript: React.FC<TranscriptProps> = ({
  history,
  realtimeInput,
  realtimeOutput,
  isConnected,
  messagesEndRef,
}) => {
  return (
    <div className="flex-1 min-h-0 w-full px-4 z-10 relative flex flex-col">
        <div className="w-full h-full pb-2 flex flex-col min-h-0">
            <div className="flex-1 bg-white/60 backdrop-blur-xl rounded-[2rem] p-4 shadow-lg border border-white/60 flex flex-col overflow-hidden relative min-h-0">
            
            <div className="absolute inset-2 overflow-y-auto scrollbar-hide pr-2">
                {history.length === 0 && !realtimeInput && !realtimeOutput && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center opacity-70">
                        <div className="w-12 h-12 bg-white/50 rounded-full flex items-center justify-center mb-2">
                            <BotIcon />
                        </div>
                        <p className="text-sm font-bold">
                            {isConnected 
                                ? "Go ahead, say hello!" 
                                : "Tap Start to chat!"
                            }
                        </p>
                    </div>
                )}

                <div className="space-y-4 pt-2">
                    {history.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center shadow-sm flex-shrink-0 text-cyan-600 border border-white mr-2 self-end mb-1">
                                    <BotIcon />
                                </div>
                            )}
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-cyan-600 text-white rounded-br-none' 
                                : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {realtimeOutput && (
                        <div className="flex justify-start">
                            <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center shadow-sm flex-shrink-0 text-cyan-600 border border-white mr-2 self-end mb-1">
                                <BotIcon />
                            </div>
                            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-none bg-white text-slate-600 text-sm font-bold shadow-sm border border-slate-100 opacity-80 animate-pulse">
                                {realtimeOutput}...
                            </div>
                        </div>
                    )}

                    {realtimeInput && (
                        <div className="flex justify-end">
                            <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-none bg-cyan-600 text-white text-sm font-bold shadow-sm opacity-80 animate-pulse">
                                {realtimeInput}...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            </div>
        </div>
    </div>
  );
};

export default Transcript;
