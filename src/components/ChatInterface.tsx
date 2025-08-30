import React, { useState, useRef, useEffect } from 'react'
import type { ChatMessage, ChatStatus, StreamingEvent, ChatMode, BlockRequest, BlockResponse, BlockErrorResponse, BlockStreamingEvent, BlockSSERequest, DocumentSource, BlockData } from '../types'
import './ChatInterface.css'

const API_BASE_URL = 'http://localhost:8000/api/chat'
const BLOCKS_API_BASE_URL = 'http://localhost:8000/api/blocks'

interface ChatInterfaceProps {
  // Component props can be added here if needed
}

export const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [status, setStatus] = useState<ChatStatus>({
    isStreaming: false,
    currentStatus: ''
  })
  const [currentResponse, setCurrentResponse] = useState('')
  const [chatMode, setChatMode] = useState<ChatMode>('block-sse')
  const [blockId, setBlockId] = useState('')
  const [storeId, setStoreId] = useState('demo-store')
  const [userId, setUserId] = useState('demo-user')
  
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

  // CUID 생성 함수 (간단한 버전)
  const generateCUID = () => {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  // 메시지 전송 함수
  const sendMessage = async () => {
    const message = inputMessage.trim()
    if (!message || status.isStreaming) return

    // 블록 생성 모드에서 blockId가 없으면 자동 생성
    if ((chatMode === 'block-rest' || chatMode === 'block-sse') && !blockId.trim()) {
      const newBlockId = generateCUID()
      setBlockId(newBlockId)
    }

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

    if (chatMode === 'rag') {
      await sendRAGMessage(message)
    } else if (chatMode === 'block-rest') {
      await sendBlockMessage(message)
    } else if (chatMode === 'block-sse') {
      await sendBlockSSEMessage(message)
    }
  }

  // RAG 메시지 전송
  const sendRAGMessage = async (message: string) => {
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
        body: JSON.stringify({ 
          message,
          storeId,
          userId
        }),
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
      let sources: DocumentSource[] = []

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
            } catch {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error('RAG Chat error:', error)
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

  // 블록 생성 메시지 전송
  const sendBlockMessage = async (message: string) => {
    setStatus({ isStreaming: true, currentStatus: '블록을 생성하고 있습니다...' })

    try {
      const currentBlockId = blockId.trim() || generateCUID()
      
      const blockRequest: BlockRequest = {
        storeId,
        userId,
        blockId: currentBlockId,
        prompt: message
      }

      const response = await fetch(BLOCKS_API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(blockRequest)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: BlockResponse | BlockErrorResponse = await response.json()

      let assistantMessage: ChatMessage

      if (result.success) {
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `블록이 성공적으로 생성되었습니다!\n\n**요약:** ${result.data.summary}`,
          timestamp: new Date(),
          blockData: {
            code: result.data.code || '코드가 없습니다.',
            summary: result.data.summary || '요약이 없습니다.',
            settings: result.data.settings || [],
            property: result.data.property || {}
          }
        }
      } else {
        assistantMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `블록 생성에 실패했습니다.\n\n**에러 타입:** ${result.error.type}\n**시간:** ${result.error.original.timestamp}`,
          timestamp: new Date()
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      setStatus({ isStreaming: false, currentStatus: '' })
      
      // BlockId 업데이트 (자동 생성된 경우)
      if (!blockId.trim()) {
        setBlockId(currentBlockId)
      }
      
      // 입력 필드에 포커스
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)

    } catch (error) {
      console.error('Block generation error:', error)
      setStatus({
        isStreaming: false,
        currentStatus: '',
        error: error instanceof Error ? error.message : '블록 생성 중 네트워크 오류가 발생했습니다.'
      })
      // 에러 발생 시에도 입력 필드에 포커스
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }

  // SSE 블록 생성 메시지 전송
  const sendBlockSSEMessage = async (message: string) => {
    setStatus({ isStreaming: true, currentStatus: '블록을 생성하고 있습니다...' })
    setCurrentResponse('')

    try {
      const currentBlockId = blockId.trim() || generateCUID()
      
      const sseRequest: BlockSSERequest = {
        prompt: message,
        storeId,
        userId,
        blockId: currentBlockId
      }

      // AbortController 생성
      abortControllerRef.current = new AbortController()

      const response = await fetch(`${BLOCKS_API_BASE_URL}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sseRequest),
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
      let fullContent = ''
      let blockData: BlockData | null = null

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
              const event: BlockStreamingEvent = eventData

              switch (event.type) {
                case 'token':
                  if (event.content && typeof event.content === 'string') {
                    fullContent += event.content
                    setCurrentResponse(fullContent)
                  }
                  break

                case 'codeToken':
                  // 실시간 코드 스트리밍 표시
                  if (event.content && typeof event.content === 'string') {
                    fullContent += event.content
                    setCurrentResponse(fullContent)
                  }
                  break

                case 'codeSectionComplete':
                  // 코드 섹션 완료 표시
                  setStatus(prev => ({ ...prev, currentStatus: '코드 생성 완료, 설정 생성 중...' }))
                  break

                case 'complete':
                  // 구조화된 블록 데이터 처리
                  if (typeof event.content === 'object' && event.content) {
                    blockData = {
                      code: event.content.code || '코드가 없습니다.',
                      summary: event.content.summary || '요약이 없습니다.',
                      settings: event.content.settings || [],
                      property: event.content.property || {}
                    }
                  } else {
                    // JSON 파싱 시도 (fallback)
                    try {
                      const cleanedContent = fullContent
                        .replace(/```json\s*/gi, '')
                        .replace(/```\s*$/gi, '')
                        .trim()
                      
                      const parsed = JSON.parse(cleanedContent)
                      blockData = {
                        code: parsed.code || '코드가 없습니다.',
                        summary: parsed.summary || '요약이 없습니다.',
                        settings: parsed.settings || [],
                        property: parsed.property || {}
                      }
                    } catch (parseError) {
                      console.warn('JSON 파싱 실패, 원본 응답 사용:', parseError)
                      blockData = {
                        code: fullContent,
                        summary: 'JSON 파싱에 실패했습니다.',
                        settings: [],
                        property: {}
                      }
                    }
                  }
                  
                  // 최종 메시지 추가
                  {
                    const finalMessage: ChatMessage = {
                    id: assistantMessageId,
                    type: 'assistant',
                    content: blockData.summary,
                    timestamp: new Date(),
                    blockData: blockData
                  }
                    setMessages(prev => [...prev, finalMessage])
                    setCurrentResponse('')
                    setStatus({ isStreaming: false, currentStatus: '' })
                    
                    // BlockId 업데이트 (자동 생성된 경우)
                    if (!blockId.trim()) {
                      setBlockId(currentBlockId)
                    }
                    
                    // 완료 후 입력 필드에 포커스
                    setTimeout(() => {
                      textareaRef.current?.focus()
                    }, 100)
                  }
                  break

                case 'outOfScope':
                  // 블록 생성 범위가 아닌 요청에 대한 안내
                  {
                    const outOfScopeMessage: ChatMessage = {
                    id: assistantMessageId,
                    type: 'assistant',
                    content: event.content as string,
                    timestamp: new Date()
                  }
                    setMessages(prev => [...prev, outOfScopeMessage])
                    setCurrentResponse('')
                    setStatus({ isStreaming: false, currentStatus: '' })
                    
                    // 완료 후 입력 필드에 포커스
                    setTimeout(() => {
                      textareaRef.current?.focus()
                    }, 100)
                  }
                  break

                case 'error':
                  throw new Error(event.content as string || '블록 생성 중 오류가 발생했습니다.')
              }
            } catch {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (error) {
      console.error('Block SSE error:', error)
      setStatus({
        isStreaming: false,
        currentStatus: '',
        error: error instanceof Error ? error.message : '블록 SSE 생성 중 네트워크 오류가 발생했습니다.'
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
        <h1>{
          chatMode === 'rag' ? 'RAG 챗봇' : 
          chatMode === 'block-rest' ? '블록 생성 (REST)' : 
          '블록 생성 (SSE)'
        }</h1>
        <p>{
          chatMode === 'rag' ? '노션 문서 기반 질의응답 시스템' :
          chatMode === 'block-rest' ? 'AI 블록 REST API 생성' :
          'AI 블록 SSE 스트리밍 생성'
        }</p>
        
        {/* 모드 전환 버튼 */}
        <div className="mode-selector">
          <button 
            className={`mode-button ${chatMode === 'block-sse' ? 'active' : ''}`}
            onClick={() => setChatMode('block-sse')}
            disabled={status.isStreaming}
          >
            블록 생성 (SSE)
          </button>
          <button 
            className={`mode-button ${chatMode === 'block-rest' ? 'active' : ''}`}
            onClick={() => setChatMode('block-rest')}
            disabled={status.isStreaming}
          >
            블록 생성 (REST)
          </button>
          <button 
            className={`mode-button ${chatMode === 'rag' ? 'active' : ''}`}
            onClick={() => setChatMode('rag')}
            disabled={status.isStreaming}
          >
            RAG 질의응답
          </button>
        </div>
        
        {/* 블록 생성 모드일 때 추가 입력 */}
        {(chatMode === 'block-rest' || chatMode === 'block-sse') && (
          <div className="block-inputs">
            <div className="input-group">
              <label htmlFor="storeId">Store ID:</label>
              <input
                id="storeId"
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="demo-store"
                disabled={status.isStreaming}
              />
            </div>
            <div className="input-group">
              <label htmlFor="userId">User ID:</label>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="demo-user"
                disabled={status.isStreaming}
              />
            </div>
            <div className="input-group">
              <label htmlFor="blockId">블록 ID (선택사항):</label>
              <input
                id="blockId"
                type="text"
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                placeholder="자동 생성됩니다"
                disabled={status.isStreaming}
              />
            </div>
          </div>
        )}
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
              
              {/* 블록 데이터 표시 */}
              {message.blockData && (
                <div className="block-data">
                  <h4>생성된 블록 정보:</h4>
                  <div className="block-info">
                    <p><strong>코드 길이:</strong> {message.blockData.code.length} characters</p>
                    <p><strong>설정 항목:</strong> {message.blockData.settings.length} items</p>
                    <p><strong>속성 개수:</strong> {Object.keys(message.blockData.property || {}).length} properties</p>
                    <details>
                      <summary>생성된 코드 보기</summary>
                      <pre className="block-code">{message.blockData.code}</pre>
                    </details>
                    <details>
                      <summary>설정 정보 보기 ({message.blockData.settings.length}개 항목)</summary>
                      <pre className="block-settings">
                        {message.blockData.settings.length > 0 
                          ? JSON.stringify(message.blockData.settings, null, 2)
                          : '설정 정보가 없습니다.'
                        }
                      </pre>
                    </details>
                    <details>
                      <summary>속성 정보 보기 ({Object.keys(message.blockData.property || {}).length}개 속성)</summary>
                      <pre className="block-property">
                        {Object.keys(message.blockData.property || {}).length > 0
                          ? JSON.stringify(message.blockData.property, null, 2)
                          : '속성 정보가 없습니다.'
                        }
                      </pre>
                    </details>
                  </div>
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
            onKeyDown={handleKeyPress}
            placeholder={
              chatMode === 'rag' 
                ? "질문을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)" 
                : chatMode === 'block-rest'
                ? "블록 생성 요청 (REST)... (Enter: 전송, Shift+Enter: 줄바꿈)"
                : "블록 생성 요청 (SSE)... (Enter: 전송, Shift+Enter: 줄바꿈)"
            }
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