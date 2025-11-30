import { useState, useEffect } from 'react'
import './SystemPromptEditor.css'

interface SystemPromptEditorProps {
  value: string
  onChange: (value: string) => void
}

export default function SystemPromptEditor({
  value,
  onChange,
}: SystemPromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleBlur = () => {
    onChange(localValue)
  }

  if (!isExpanded && !localValue) {
    return (
      <button
        className="system-prompt-toggle"
        onClick={() => setIsExpanded(true)}
        type="button"
      >
        + Add system prompt
      </button>
    )
  }

  return (
    <div className="system-prompt-editor">
      <div className="system-prompt-header">
        <label htmlFor="system-prompt">System Prompt:</label>
        <button
          className="system-prompt-close"
          onClick={() => {
            setIsExpanded(false)
            if (!localValue) {
              onChange('')
            }
          }}
          type="button"
          aria-label="Close system prompt editor"
        >
          ×
        </button>
      </div>
      <textarea
        id="system-prompt"
        className="system-prompt-textarea"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Enter system prompt (optional)..."
        rows={3}
      />
    </div>
  )
}

