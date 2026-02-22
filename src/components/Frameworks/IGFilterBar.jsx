import React from 'react'

const IG_OPTIONS = [
  { value: 1, label: 'IG1', desc: 'Essential Cyber Hygiene' },
  { value: 2, label: 'IG1 + IG2', desc: 'Intermediate' },
  { value: 3, label: 'All', desc: 'All Safeguards' },
]

export default function IGFilterBar({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-txt-3">Implementation Group</span>
      <div className="flex rounded-[10px] overflow-hidden border border-border bg-white">
        {IG_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`px-3.5 py-1.5 text-[0.78rem] font-semibold border-none cursor-pointer font-sans transition-all duration-150 ${
              value === opt.value
                ? 'bg-brand text-white shadow-sm'
                : 'bg-transparent text-txt-2 hover:bg-subtle'
            }`}
            onClick={() => onChange(opt.value)}
            title={opt.desc}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
