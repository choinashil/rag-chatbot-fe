import { useState } from 'react'
import { ChatInterface } from './components/ChatInterface'
import CodeVisualization from './components/CodeVisualization'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'visualization'>('chat')

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  }

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    backgroundColor: isActive ? '#3b82f6' : '#e5e7eb',
    color: isActive ? 'white' : '#374151',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease'
  })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={navStyle}>
        <button 
          onClick={() => setCurrentView('chat')}
          style={buttonStyle(currentView === 'chat')}
        >
          💬 RAG 챗봇
        </button>
        <button 
          onClick={() => setCurrentView('visualization')}
          style={buttonStyle(currentView === 'visualization')}
        >
          🎨 블록 시각화
        </button>
      </nav>
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {currentView === 'chat' ? <ChatInterface /> : <CodeVisualization />}
      </div>
    </div>
  )
}

export default App
