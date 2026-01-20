import React from 'react';
import ReactMarkdown from 'react-markdown';
import { BotIcon } from '../../../shared/components/icons/LiveIcons';
import { HistoryItem } from '../../../shared/types';

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
    <div className="h-full w-full z-10 relative flex flex-col">
        <div className="w-full h-full pb-2 flex flex-col">
            <div className="h-full bg-white backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-zinc-200 flex flex-col overflow-hidden relative">

            <div className="absolute inset-2 overflow-y-auto scrollbar-hide pr-2">
                {history.length === 0 && !realtimeInput && !realtimeOutput && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 font-bold opacity-60">
                        <p className="text-xl">Go ahead, say hello!</p>
                    </div>
                )}

                <div className="space-y-4 pt-2">
                    {history.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                            {msg.role === 'model' && (
                                <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shadow-sm flex-shrink-0 text-zinc-500 border border-white mr-1.5 self-end mb-1 scale-[0.6]">
                                    <BotIcon />
                                </div>
                            )}
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[15px] leading-snug shadow-sm prose prose-sm prose-zinc ${
                                msg.role === 'user'
                                ? 'bg-zinc-900 text-white rounded-br-none prose-invert'
                                : 'bg-zinc-50 text-zinc-800 rounded-bl-none border border-zinc-100'
                            }`}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {realtimeOutput && (
                        <div className="flex justify-start">
                            <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center shadow-sm flex-shrink-0 text-zinc-500 border border-white mr-1.5 self-end mb-1 scale-[0.6]">
                                <BotIcon />
                            </div>
                            <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-none bg-zinc-50 text-zinc-600 text-[15px] leading-snug shadow-sm border border-zinc-100 opacity-80 animate-pulse prose prose-sm prose-zinc">
                                <ReactMarkdown>{realtimeOutput + '...'}</ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {realtimeInput && (
                        <div className="flex justify-end">
                            <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-br-none bg-zinc-900 text-white text-[15px] leading-snug shadow-sm opacity-80 animate-pulse">
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
