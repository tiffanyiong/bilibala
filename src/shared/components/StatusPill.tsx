import React from 'react';

interface StatusPillProps {
  isConnected: boolean;
  isAiSpeaking: boolean;
  isAiThinking: boolean;
  realtimeInput: string;
  error: string | null;
}

const StatusPill: React.FC<StatusPillProps> = ({
  isConnected,
  isAiSpeaking,
  isAiThinking,
  realtimeInput,
  error
}) => {
  if (error) {
    return (
        <div className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-xs md:text-sm font-bold border border-red-200 shadow-sm text-center max-w-full break-words">
            {error}
        </div>
    );
  }

  let statusText = "Ready";
  let statusColor = "bg-white text-slate-400";
  
  if (isConnected) {
     if (isAiSpeaking) {
         statusText = "Bilibala is speaking...";
         statusColor = "bg-cyan-100 text-cyan-600 animate-pulse border-cyan-200";
     } else if (isAiThinking) {
         statusText = "Listening...";
         statusColor = "bg-green-100 text-green-600 animate-pulse border-green-200";
     } else if (realtimeInput) {
         statusText = "Listening...";
         statusColor = "bg-green-100 text-green-600 animate-pulse border-green-200";
     } else {
         statusText = "Listening...";
         statusColor = "bg-white text-cyan-600 border-white";
     }
  }

  return (
    <div className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm transition-all duration-300 ${isConnected ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${statusColor}`}>
        {statusText}
    </div>
  );
};

export default StatusPill;
