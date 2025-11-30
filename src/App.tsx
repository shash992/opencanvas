import { Routes, Route, Navigate } from 'react-router-dom'
import ChatMode from './components/chat/ChatMode'
import CanvasMode from './components/canvas/CanvasMode'
import Layout from './components/Layout'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatMode />} />
        <Route path="/canvas" element={<CanvasMode />} />
      </Routes>
    </Layout>
  )
}

export default App

