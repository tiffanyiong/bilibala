import React, { useState, useRef, useEffect } from 'react';

interface GlassDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

const GlassDropdown: React.FC<GlassDropdownProps> = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Scroll selected item into view when dropdown opens
  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="
          w-full flex items-center justify-between
          bg-white
          border border-stone-200
          text-stone-700 text-base sm:text-sm
          rounded-xl py-2 sm:py-2.5 px-3 sm:px-3.5
          outline-none
          ring-1 ring-black/[0.04]
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_8px_rgba(0,0,0,0.04)]
          hover:bg-stone-50 hover:shadow-[inset_0_1px_2px_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.06)]
          focus:ring-2 focus:ring-stone-300/50
          transition-all duration-200 cursor-pointer
          text-left
        "
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-stone-400 ml-2 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="
            absolute z-50 left-0 right-0 mt-1.5
            bg-white
            border border-stone-200
            rounded-2xl
            shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.05)]
            ring-1 ring-black/[0.04]
            overflow-hidden
            animate-[glassDropIn_0.2s_ease-out]
          "
        >
          {/* Top highlight — mimics light refraction on glass edge */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-100 to-transparent" />

          <div ref={listRef} className="max-h-64 overflow-y-auto py-1.5 px-1.5 space-y-0.5 scroll-smooth">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`
                    w-full flex items-center
                    text-left text-sm sm:text-[13px]
                    rounded-xl px-3 py-2 sm:py-1.5
                    transition-all duration-150 cursor-pointer
                    ${
                      isSelected
                        ? 'bg-stone-100 text-stone-800 font-medium'
                        : 'text-stone-600 hover:bg-stone-100/60 hover:text-stone-800'
                    }
                  `}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom highlight */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-stone-100 to-transparent" />
        </div>
      )}
    </div>
  );
};

export default GlassDropdown;
