import { useState, useEffect } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { PlusIcon, SelectIcon, XIcon, TrashIcon } from '../ui/Icons'
import './CanvasSessions.css'

export default function CanvasSessions() {
  const { sessions, currentSessionId, loadSession, deleteSession, updateSessionTitle, loadSessions } = useCanvasStore()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Wait a bit for storage to initialize
    const initAndLoad = async () => {
      try {
        const { initStorage } = await import('../../services/storage')
        await initStorage()
        await loadSessions()
      } catch (error) {
        console.error('Failed to initialize storage in CanvasSessions:', error)
      }
    }
    
    initAndLoad()
    // Reload sessions periodically to catch updates
    const interval = setInterval(() => {
      loadSessions().catch(err => console.error('Failed to reload sessions:', err))
    }, 2000)
    return () => clearInterval(interval)
  }, [loadSessions])

  const handleNewSession = async () => {
    // Just clear the current session - don't create a blank one
    // Session will be created automatically when first node is added
    // Clear current session and show blank canvas
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      currentSessionId: null,
    })
    setSelectionMode(false)
    setSelectedSessions(new Set())
  }

  const handleSelectSession = async (sessionId: string) => {
    if (selectionMode) {
      // Toggle selection
      const newSelected = new Set(selectedSessions)
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId)
      } else {
        newSelected.add(sessionId)
      }
      setSelectedSessions(newSelected)
    } else {
      await loadSession(sessionId)
    }
  }

  const handleSelectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessions.map((s) => s.id)))
    }
  }

  const handleDelete = async () => {
    if (selectedSessions.size === 0) return

    const confirmMessage =
      selectedSessions.size === 1
        ? 'Are you sure you want to delete this canvas session?'
        : `Are you sure you want to delete ${selectedSessions.size} canvas sessions?`

    if (window.confirm(confirmMessage)) {
      for (const sessionId of selectedSessions) {
        await deleteSession(sessionId)
      }
      setSelectedSessions(new Set())
      setSelectionMode(false)
    }
  }

  const handleCancel = () => {
    setSelectionMode(false)
    setSelectedSessions(new Set())
  }

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedSessions(new Set())
  }

  return (
    <div className="canvas-sessions">
      <div className="canvas-sessions-header">
        {!selectionMode ? (
          <>
            <h3 className="canvas-sessions-title">Canvas Sessions</h3>
            <div className="canvas-sessions-actions">
              <button
                className="canvas-sessions-action-button"
                onClick={handleToggleSelectionMode}
                aria-label="Select sessions"
                title="Select sessions"
              >
                <SelectIcon />
              </button>
              <button
                className="canvas-sessions-action-button"
                onClick={handleNewSession}
                aria-label="New canvas session"
                title="New canvas session"
              >
                <PlusIcon />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              className="canvas-sessions-action-button"
              onClick={handleSelectAll}
              aria-label="Select all"
              title="Select all"
            >
              <SelectIcon />
            </button>
            <div className="canvas-sessions-actions">
              <button
                className="canvas-sessions-action-button"
                onClick={handleDelete}
                disabled={selectedSessions.size === 0}
                aria-label="Delete selected"
                title="Delete selected"
              >
                <TrashIcon />
              </button>
              <button
                className="canvas-sessions-action-button"
                onClick={handleCancel}
                aria-label="Cancel"
                title="Cancel"
              >
                <XIcon />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="canvas-sessions-list">
        {sessions.length === 0 ? (
          <div className="canvas-sessions-empty">
            <p>No canvas sessions yet</p>
            <button className="canvas-sessions-new-button" onClick={handleNewSession}>
              Create New Session
            </button>
          </div>
        ) : (
          sessions
            .sort((a, b) => b.updatedAt - a.updatedAt) // Sort by last changed (updatedAt)
            .map((session) => (
              <CanvasSessionItem
                key={session.id}
                session={session}
                isSelected={currentSessionId === session.id}
                isSelectionMode={selectionMode}
                isChecked={selectedSessions.has(session.id)}
                onSelect={handleSelectSession}
                onUpdateTitle={updateSessionTitle}
              />
            ))
        )}
      </div>
    </div>
  )
}

interface CanvasSessionItemProps {
  session: { id: string; title: string; updatedAt: number }
  isSelected: boolean
  isSelectionMode: boolean
  isChecked: boolean
  onSelect: (sessionId: string) => void
  onUpdateTitle: (sessionId: string, title: string) => Promise<void>
}

function CanvasSessionItem({
  session,
  isSelected,
  isSelectionMode,
  isChecked,
  onSelect,
  onUpdateTitle,
}: CanvasSessionItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(session.title)

  const handleBlur = () => {
    setIsEditing(false)
    if (title.trim() !== session.title) {
      onUpdateTitle(session.id, title)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      setIsEditing(false)
      if (title.trim() !== session.title) {
        onUpdateTitle(session.id, title)
      }
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return 'Today'
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return `${days} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleItemClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on checkbox or input
    if ((e.target as HTMLElement).closest('.canvas-session-checkbox') ||
        (e.target as HTMLElement).closest('.canvas-session-title-input')) {
      return
    }
    if (!isEditing) {
      onSelect(session.id)
    }
  }

  return (
    <div
      className={`canvas-session-item ${isSelected ? 'selected' : ''} ${isChecked ? 'checked' : ''}`}
      onClick={handleItemClick}
    >
      {isSelectionMode && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onSelect(session.id)}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(session.id)
          }}
          className="canvas-session-checkbox"
        />
      )}
      <div className="canvas-session-content">
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="canvas-session-title-input"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h4
            className="canvas-session-title"
            onDoubleClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
          >
            {session.title}
          </h4>
        )}
        <p className="canvas-session-date">{formatDate(session.updatedAt)}</p>
      </div>
    </div>
  )
}

