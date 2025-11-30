import type { Message } from '../../services/storage/types'
import './MessageList.css'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export default function MessageList({ messages, isLoading = false }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <div key={index} className={`message-bubble ${message.role}-bubble`}>
          <div className="message-content">{message.content}</div>
        </div>
      ))}
      {isLoading && (
        <div className="message-bubble assistant-bubble typing-indicator">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  )
}
