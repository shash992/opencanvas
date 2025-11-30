import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useChatStore } from '../stores/chatStore'
import ChatSessions from './chat/ChatSessions'
import CanvasSessions from './canvas/CanvasSessions'
import SettingsPanel from './settings/SettingsPanel'
import {
  ChatIcon,
  CanvasIcon,
  PlusIcon,
  SettingsIcon,
  HamburgerIcon,
} from './ui/Icons'
import './Sidebar.css'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { createChat } = useChatStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const isChat = location.pathname === '/chat'
  const isCanvas = location.pathname === '/canvas'

  const handleNewChat = async () => {
    await createChat()
  }

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <div className="sidebar-brand">OpenCanvas</div>}
        <button
          className="sidebar-collapse-button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <HamburgerIcon />
        </button>
      </div>

      <div className="sidebar-navigation">
        <button
          className={`sidebar-nav-item ${isChat ? 'active' : ''}`}
          onClick={() => navigate('/chat')}
          title="Chat"
        >
          <ChatIcon />
          {!collapsed && <span>Chat</span>}
        </button>
        <button
          className={`sidebar-nav-item ${isCanvas ? 'active' : ''}`}
          onClick={() => navigate('/canvas')}
          title="Canvas"
        >
          <CanvasIcon />
          {!collapsed && <span>Canvas</span>}
        </button>
      </div>

      <div className="sidebar-divider" />

      {collapsed ? (
        <div className="sidebar-quick-actions">
          {isChat && (
            <button
              className="sidebar-icon-button"
              onClick={handleNewChat}
              aria-label="New chat"
              title="New chat"
            >
              <PlusIcon />
            </button>
          )}
        </div>
      ) : (
        <div className="sidebar-content">
          {isChat && <ChatSessions />}
          {isCanvas && <CanvasSessions />}
        </div>
      )}

      <div className="sidebar-footer">
        <button
          className="sidebar-icon-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
