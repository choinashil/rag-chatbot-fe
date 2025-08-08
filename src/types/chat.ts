// 채팅 관련 타입 정의

export interface StreamingChatRequest {
  message: string
}

export interface StreamingEvent {
  type: 'status' | 'token' | 'sources' | 'done' | 'error'
  content?: string
  data?: any
}

export interface DocumentSource {
  id: string
  title: string
  content: string
  score: number
  url?: string
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: DocumentSource[]
}

export interface ChatStatus {
  isStreaming: boolean
  currentStatus: string
  error?: string
}