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

  const btnClass = variant === 'danger' ? 'btn-danger-outline' : 'btn-primary'

  return (
    <div
      className="confirm-dialog-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        {promptMode && (
          <input
            ref={inputRef}
            className="confirm-dialog-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={promptPlaceholder}
            aria-label={promptPlaceholder || 'Enter a note'}
          />
        )}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="submit" className={btnClass}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
