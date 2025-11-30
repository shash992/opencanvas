import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { PencilIcon } from '../ui/Icons'
import './ChatHeader.css'

export default function ChatHeader() {
  const { currentChat, updateChatTitle } = useChatStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showEditIcon, setShowEditIcon] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (currentChat) {
      setEditValue(currentChat.title)
    }
  }, [currentChat])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (currentChat) {
      setEditValue(currentChat.title)
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    if (!currentChat || isSavingRef.current) return
    
    isSavingRef.current = true
    const trimmedValue = editValue.trim()
    if (trimmedValue) {
      await updateChatTitle(currentChat.id, trimmedValue)
    } else {
      // Reset to original if empty
      setEditValue(currentChat.title)
    }
    setIsEditing(false)
    isSavingRef.current = false
  }

  const handleCancel = () => {
    if (currentChat) {
      setEditValue(currentChat.title)
    }
    setIsEditing(false)
  }

  const handleBlur = () => {
    // Use setTimeout to allow Enter key handler to complete first
    setTimeout(() => {
      if (!isSavingRef.current) {
        handleSave()
      }
    }, 0)
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      await handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (!currentChat) return null

  return (
    <div
      className="chat-header"
      onMouseEnter={() => setShowEditIcon(true)}
      onMouseLeave={() => setShowEditIcon(false)}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="chat-header-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          maxLength={100}
        />
      ) : (
        <>
          <h1 className="chat-header-title">{currentChat.title}</h1>
          {showEditIcon && (
            <button
              className="chat-header-edit-button"
              onClick={handleStartEdit}
              aria-label="Edit chat name"
              title="Edit chat name"
            >
              <PencilIcon />
            </button>
          )}
        </>
      )}
    </div>
  )
}

