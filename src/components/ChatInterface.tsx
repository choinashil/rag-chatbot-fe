import React, { useState, useRef, useEffect } from 'react'
import type { ChatMessage, ChatStatus, StreamingEvent } from '../types'
import './ChatInterface.css'

const API_BASE_URL = 'http://localhost:8000/api/chat'

interface ChatInterfaceProps {}

export const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [status, setStatus] = useState<ChatStatus>({
    isStreaming: false,
    currentStatus: ''
  })
  const [currentResponse, setCurrentResponse] = useState('')
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 메시지 영역 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentResponse])

  // 메시지 전송 함수
  const sendMessage = async () => {
    const message = inputMessage.trim()
    if (!message || status.isStreaming) return

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    
    // 입력 필드에 포커스 유지
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    
    // 스트리밍 상태 초기화
    setStatus({ isStreaming: true, currentStatus: '질문을 처리 중입니다...' })
    setCurrentResponse('')

    try {
      // AbortController 생성
      abortControllerRef.current = new AbortController()
      
      // API 요청
      const response = await fetch(`${API_BASE_URL}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // ReadableStream 처리
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const assistantMessageId = Date.now().toString()
      let assistantMessage = ''
      let sources: any[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6))
              const event: StreamingEvent = eventData

              switch (event.type) {
                case 'status':
                  setStatus(prev => ({ ...prev, currentStatus: event.content || '' }))
                  break

                case 'token':
                  if (event.content) {
                    assistantMessage += event.content
                    setCurrentResponse(assistantMessage)
                  }
                  break

                case 'sources':
                  if (event.data) {
                    sources = event.data
                  }
                  break

                case 'done':
                  // 최종 메시지 추가
                  // eslint-disable-next-line no-case-declarations
                  const finalMessage: ChatMessage = {
                    id: assistantMessageId,
                    type: 'assistant',
                    content: assistantMessage,
                    timestamp: new Date(),
                    sources: sources
                  }
                  setMessages(prev => [...prev, finalMessage])
                  setCurrentResponse('')
                  setStatus({ isStreaming: false, currentStatus: '' })
                  // 스트리밍 완료 후 입력 필드에 포커스
                  setTimeout(() => {
                    textareaRef.current?.focus()
                  }, 100)
                  break

                case 'error':
                  throw new Error(event.content || '알 수 없는 오류가 발생했습니다.')
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setStatus({
        isStreaming: false,
        currentStatus: '',
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.'
      })
      setCurrentResponse('')
      // 에러 발생 시에도 입력 필드에 포커스
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 전송 중단
  const cancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setStatus({ isStreaming: false, currentStatus: '' })
    setCurrentResponse('')
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h1>RAG 챗봇</h1>
        <p>노션 문서 기반 질의응답 시스템</p>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.type}`}>
            <div className="message-content">
              <p>{message.content}</p>
              {message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <h4>참조 문서:</h4>
                  <ul>
                    {message.sources.map((source, index) => (
                      <li key={index}>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.title}
                          </a>
                        ) : (
                          <span>{source.title}</span>
                        )}
                        <span className="source-score"> (유사도: {source.score.toFixed(3)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {/* 실시간 응답 표시 */}
        {status.isStreaming && currentResponse && (
          <div className="message message-assistant streaming">
            <div className="message-content">
              <p>{currentResponse}<span className="typing-cursor">|</span></p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 상태 표시 */}
      {status.isStreaming && (
        <div className="chat-status">
          <div className="status-indicator">
            <div className="loading-spinner"></div>
            <span>{status.currentStatus}</span>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {status.error && (
        <div className="chat-error">
          <p>오류: {status.error}</p>
          <button onClick={() => setStatus(prev => ({ ...prev, error: undefined }))}>
            닫기
          </button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="chat-input">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="질문을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            disabled={status.isStreaming}
            rows={3}
          />
          <div className="input-buttons">
            {status.isStreaming ? (
              <button onClick={cancelStreaming} className="cancel-button">
                중단
              </button>
            ) : (
              <button 
                onClick={sendMessage} 
                disabled={!inputMessage.trim()}
                className="send-button"
              >
                전송
              </button>
            )}
          </div>
        </div>
        <div className="input-hint">
          Enter 키로 전송, Shift+Enter로 줄바꿈
        </div>
      </div>
    </div>
  )
}