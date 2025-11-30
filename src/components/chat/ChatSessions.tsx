import { useState, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { PlusIcon, SelectIcon, XIcon, TrashIcon } from '../ui/Icons'
import './ChatSessions.css'

export default function ChatSessions() {
  const { chats, currentChat, createChat, loadChat, deleteChats } = useChatStore()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handleNewChatEvent = async () => {
      await createChat()
      setSelectionMode(false)
      setSelectedChats(new Set())
    }

    window.addEventListener('new-chat', handleNewChatEvent as EventListener)
    return () => window.removeEventListener('new-chat', handleNewChatEvent as EventListener)
  }, [createChat])

  const handleNewChat = async () => {
    await createChat()
    setSelectionMode(false)
    setSelectedChats(new Set())
  }

  const handleSelectChat = async (chatId: string) => {
    if (selectionMode) {
      // Toggle selection
      const newSelected = new Set(selectedChats)
      if (newSelected.has(chatId)) {
        newSelected.delete(chatId)
      } else {
        newSelected.add(chatId)
      }
      setSelectedChats(newSelected)
    } else {
      await loadChat(chatId)
    }
  }

  const handleSelectAll = () => {
    if (selectedChats.size === chats.length) {
      setSelectedChats(new Set())
    } else {
      setSelectedChats(new Set(chats.map((c) => c.id)))
    }
  }

  const handleDelete = async () => {
    if (selectedChats.size === 0) return

    const confirmMessage =
      selectedChats.size === 1
        ? 'Are you sure you want to delete this chat?'
        : `Are you sure you want to delete ${selectedChats.size} chats?`

    if (window.confirm(confirmMessage)) {
      await deleteChats(Array.from(selectedChats))
      setSelectedChats(new Set())
      setSelectionMode(false)
    }
  }

  const handleCancel = () => {
    setSelectionMode(false)
    setSelectedChats(new Set())
  }

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedChats(new Set())
  }

  return (
    <div className="chat-sessions">
      <div className="chat-sessions-header">
        {!selectionMode ? (
          <>
            <h2>Sessions</h2>
            <div className="chat-sessions-header-actions">
              <button
                className="chat-sessions-icon-button"
                onClick={handleNewChat}
                aria-label="New chat"
                title="New chat"
              >
                <PlusIcon />
              </button>
              <button
                className="chat-sessions-icon-button"
                onClick={handleToggleSelectionMode}
                aria-label="Select chats"
                title="Select chats"
              >
                <SelectIcon />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              className="chat-sessions-icon-button"
              onClick={handleSelectAll}
              aria-label={selectedChats.size === chats.length ? 'Deselect all' : 'Select all'}
              title={selectedChats.size === chats.length ? 'Deselect all' : 'Select all'}
            >
              <SelectIcon />
            </button>
            <div className="chat-sessions-header-right">
              <button
                className="chat-sessions-icon-button delete"
                onClick={handleDelete}
                disabled={selectedChats.size === 0}
                aria-label="Delete selected"
                title="Delete selected"
              >
                <TrashIcon />
              </button>
              <button
                className="chat-sessions-icon-button"
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
      <div className="chat-sessions-list">
        {chats.length === 0 ? (
          <div className="chat-sessions-empty">No sessions yet</div>
        ) : (
          chats
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((chat) => (
              <button
                key={chat.id}
                className={`chat-sessions-item ${
                  currentChat?.id === chat.id ? 'active' : ''
                } ${selectionMode && selectedChats.has(chat.id) ? 'selected' : ''}`}
                onClick={() => handleSelectChat(chat.id)}
              >
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedChats.has(chat.id)}
                    onChange={() => handleSelectChat(chat.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="chat-sessions-checkbox"
                  />
                )}
                <div className="chat-sessions-item-content">
                  <div className="chat-sessions-item-title">{chat.title}</div>
                  <div className="chat-sessions-item-meta">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))
        )}
      </div>
    </div>
  )
}
