import React, { useEffect, useRef, useState } from 'react'

/**
 * Reusable confirm/prompt dialog to replace native confirm() and prompt().
 * Supports: confirm mode (yes/no) and prompt mode (text input + confirm).
 */
export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default', // 'default' | 'danger'
  promptMode = false,
  promptPlaceholder = '',
  onConfirm,
  onCancel,
}) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (open) {
      setInputValue('')
      setTimeout(() => {
        if (promptMode && inputRef.current) {
          inputRef.current.focus()
        } else if (confirmRef.current) {
          confirmRef.current.focus()
        }
      }, 50)
    }
  }, [open, promptMode])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(promptMode ? inputValue : true)
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-[overlayIn_0.2s_ease-out]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-[420px] shadow-xl border border-white/60 animate-[modalIn_0.3s_cubic-bezier(0.22,1,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-[1.05rem] font-bold tracking-tight text-txt mb-1.5">{title}</h3>
        <p className="text-[0.88rem] text-txt-2 leading-relaxed mb-5">{message}</p>
        {promptMode && (
          <input
            ref={inputRef}
            className="w-full bg-white border border-border rounded-[10px] px-3 py-2.5 text-[0.88rem] font-sans text-txt mb-4 outline-none transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15 placeholder:text-txt-3"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={promptPlaceholder}
            aria-label={promptPlaceholder || 'Enter a note'}
          />
        )}
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            className="bg-white text-txt-2 border border-border rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-subtle hover:border-gray-300 hover:text-txt active:scale-[0.97]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          {variant === 'danger' ? (
            <button
              ref={confirmRef}
              type="submit"
              className="bg-transparent text-red border border-red/25 rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-150 hover:bg-red-bg hover:border-red/40 hover:shadow-[0_0_12px_rgba(220,38,38,0.15)] active:scale-[0.97]"
            >
              {confirmLabel}
            </button>
          ) : (
            <button
              ref={confirmRef}
              type="submit"
              className="bg-gradient-to-br from-brand to-brand-deep text-white border-none rounded-[10px] px-4 py-2 text-[0.85rem] font-semibold cursor-pointer font-sans transition-all duration-200 shadow-[0_2px_8px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:from-brand-hover hover:to-[#1e3a8a] hover:shadow-[0_4px_16px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
