import { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { getStorage } from '../../services/storage'
import { PencilIcon, PlusIcon, DatabaseIcon, BranchIcon, MergeIcon } from '../ui/Icons'
import './CanvasHeader.css'

interface CanvasHeaderProps {
  onAddChatNode: () => void
  onAddMemoryNode: () => void
  onBranch: () => void
  onMerge: () => void
  selectedNodeIds: string[]
}

export default function CanvasHeader({
  onAddChatNode,
  onAddMemoryNode,
  onBranch,
  onMerge,
  selectedNodeIds,
}: CanvasHeaderProps) {
  const { currentSessionId, sessions, updateSessionTitle } = useCanvasStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showEditIcon, setShowEditIcon] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSavingRef = useRef(false)

  const currentSession = sessions.find(s => s.id === currentSessionId)
  
  // Load session title when it changes
  useEffect(() => {
    const loadCurrentSession = async () => {
      if (currentSessionId) {
        if (currentSession) {
          setEditValue(currentSession.title)
        } else {
          // Try to load from storage if not in list
          try {
            const storage = getStorage()
            const session = await storage.getCanvasSession(currentSessionId)
            if (session) {
              setEditValue(session.title)
            } else {
              setEditValue('New Canvas')
            }
          } catch (error) {
            console.error('Failed to load session:', error)
            setEditValue('New Canvas')
          }
        }
      } else {
        setEditValue('New Canvas')
      }
    }
    loadCurrentSession()
  }, [currentSessionId, currentSession?.title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (currentSessionId) {
      // Use current editValue or load from session
      if (!editValue || editValue === 'New Canvas') {
        if (currentSession) {
          setEditValue(currentSession.title)
        } else {
          // Try to load from storage
          getStorage().getCanvasSession(currentSessionId).then(session => {
            if (session) {
              setEditValue(session.title)
            }
          })
        }
      }
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    if (!currentSessionId || isSavingRef.current) return
    
    isSavingRef.current = true
    const trimmedValue = editValue.trim()
    if (trimmedValue) {
      await updateSessionTitle(currentSessionId, trimmedValue)
      // Reload sessions to get updated title
      const { loadSessions } = useCanvasStore.getState()
      await loadSessions()
      // Update local editValue to reflect saved title
      setEditValue(trimmedValue)
    } else {
      // Reset to original if empty
      try {
        const session = currentSession || await getStorage().getCanvasSession(currentSessionId)
        if (session) {
          setEditValue(session.title)
        } else {
          setEditValue('New Canvas')
        }
      } catch (error) {
        setEditValue('New Canvas')
      }
    }
    setIsEditing(false)
    isSavingRef.current = false
  }

  const handleCancel = async () => {
    if (currentSessionId) {
      const session = currentSession || await getStorage().getCanvasSession(currentSessionId)
      if (session) {
        setEditValue(session.title)
      } else {
        setEditValue('New Canvas')
      }
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

  // Show default title if no session yet
  const displayTitle = currentSession?.title || editValue || 'New Canvas'

  return (
    <div className="canvas-header">
      <div
        className="canvas-header-title-section"
        onMouseEnter={() => {
          if (currentSessionId) {
            setShowEditIcon(true)
          }
        }}
        onMouseLeave={() => setShowEditIcon(false)}
      >
        {isEditing && currentSessionId ? (
          <input
            ref={inputRef}
            type="text"
            className="canvas-header-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            maxLength={100}
          />
        ) : (
          <>
            <h1 
              className="canvas-header-title"
              onClick={() => currentSessionId && handleStartEdit()}
            >
              {displayTitle}
            </h1>
            {showEditIcon && currentSessionId && (
              <button
                className="canvas-header-edit-button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStartEdit()
                }}
                aria-label="Edit canvas name"
                title="Edit canvas name"
              >
                <PencilIcon />
              </button>
            )}
          </>
        )}
      </div>
      <div className="canvas-header-toolbar">
        <button
          className="canvas-header-button"
          onClick={onAddChatNode}
          aria-label="Add chat node"
          title="Add chat node"
        >
          <PlusIcon />
        </button>
        <button
          className="canvas-header-button"
          onClick={onAddMemoryNode}
          aria-label="Add memory node"
          title="Add memory node"
        >
          <DatabaseIcon />
        </button>
        <button
          className="canvas-header-button"
          onClick={onBranch}
          disabled={selectedNodeIds.length !== 1}
          aria-label="Branch chat"
          title="Branch from selected chat node"
        >
          <MergeIcon />
        </button>
        <button
          className="canvas-header-button"
          onClick={onMerge}
          disabled={selectedNodeIds.length < 2}
          aria-label="Merge chats"
          title="Merge selected chat nodes"
        >
          <BranchIcon />
        </button>
      </div>
    </div>
  )
}

