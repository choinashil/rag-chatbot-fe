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
  blockData?: BlockData  // 블록 생성 결과 추가
}

export interface ChatStatus {
  isStreaming: boolean
  currentStatus: string
  error?: string
}

// 블록 생성 관련 타입
export interface BlockRequest {
  storeId: string
  userId: string
  blockId: string
  prompt: string
}

export interface BlockData {
  code: string
  settings: any[]
  property: Record<string, any>
  summary: string
}

export interface BlockResponse {
  success: true
  data: BlockData
  traceId?: string
}

export interface BlockErrorResponse {
  success: false
  error: {
    type: string
    original: {
      timestamp: string
      [key: string]: any
    }
  }
  blockId: string
  traceId?: string
}

// 채팅 모드 타입
export type ChatMode = 'rag' | 'block-rest' | 'block-sse'

// SSE 블록 스트리밍 이벤트
export interface BlockStreamingEvent {
  type: 'token' | 'complete' | 'error' | 'outOfScope'
  content?: string | {
    code: string
    summary: string
  }
  data?: {
    code?: string
    summary?: string
  }
}

// SSE 블록 생성 요청
export interface BlockSSERequest {
  prompt: string
  storeId?: string
  userId?: string
  blockId?: string
}