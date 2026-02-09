import React from 'react';

interface SubScoreBarProps {
  label: string;
  value: number;
  max: number;
}

function getBarColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio >= 0.78) return 'bg-emerald-400';
  if (ratio >= 0.56) return 'bg-sky-400';
  if (ratio >= 0.33) return 'bg-amber-400';
  return 'bg-red-400';
}

const SubScoreBar: React.FC<SubScoreBarProps> = ({ label, value, max }) => {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-stone-500 min-w-[110px] max-w-[160px] flex-shrink-0">{label}</span>
      <div className="flex-1 h-[5px] bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(value, max)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-stone-600 w-8 text-right tabular-nums">
        {max <= 9 ? value.toFixed(1) : value}
      </span>
    </div>
  );
};

export default SubScoreBar;
