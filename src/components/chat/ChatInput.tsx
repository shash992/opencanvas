import { useState, KeyboardEvent, ReactNode } from 'react'
import { StopIcon } from '../ui/Icons'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  children?: ReactNode
}

export default function ChatInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = 'What would you like to chat about...',
  children,
}: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStop = () => {
    // TODO: Implement stop functionality
    console.log('Stop generation')
  }

  return (
    <div className="chat-input-bar">
      <div className="chat-input-main">
        <textarea
          className="chat-input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
      </div>
      <div className="chat-input-controls">
        <div className="chat-input-controls-left">
          {children}
        </div>
        <div className="chat-input-controls-right">
          {isLoading ? (
            <button
              className="chat-input-icon-button stop"
              onClick={handleStop}
              aria-label="Stop generation"
              title="Stop generation"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              className="chat-input-send-button"
              onClick={handleSend}
              disabled={disabled || !input.trim()}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
