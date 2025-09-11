import React, { useState } from 'react';
import BlockRenderer from './BlockRenderer';

interface BlockData {
  blockId: string;
  createdAt: string;
  success: boolean;
  code: string;
  summary: string;
  property: any;
  settings: any[];
  inputPrompt: string;
}

const CodeVisualization: React.FC = () => {
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [blockId, setBlockId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchBlockData = async () => {
    if (!blockId.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // 백엔드 API URL (개발 환경)
      const apiUrl = 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/analytics/blocks/${blockId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('블록을 찾을 수 없습니다');
        }
        throw new Error(`서버 오류: ${response.status}`);
      }
      
      const data = await response.json();
      setBlockData(data);
    } catch (err) {
      setError((err as Error).message);
      setBlockData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchBlockData();
    }
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '32px',
    textAlign: 'center'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '600',
    color: '#ffffff',
    margin: '0 0 8px 0'
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '16px',
    color: '#d1d5db',
    margin: 0
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    justifyContent: 'center',
    alignItems: 'center'
  };

  const inputStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    width: '300px',
    outline: 'none'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: loading ? '#9ca3af' : '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontWeight: '500'
  };

  const errorStyle: React.CSSProperties = {
    color: '#dc3545',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    padding: '12px 16px',
    borderRadius: '8px',
    margin: '16px 0',
    textAlign: 'center'
  };

  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
    color: '#1f2937'
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 12px 0'
  };

  const promptStyle: React.CSSProperties = {
    backgroundColor: '#f5f5f5',
    padding: '12px',
    borderRadius: '6px',
    fontFamily: 'Monaco, "Courier New", monospace',
    whiteSpace: 'pre-wrap' as const,
    fontSize: '14px',
    lineHeight: '1.5',
    border: '1px solid #e5e5e5',
    color: '#1f2937'
  };

  const infoGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  };

  const codeBlockStyle: React.CSSProperties = {
    background: '#f8f8f8',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '14px',
    border: '1px solid #e5e5e5',
    fontFamily: 'Monaco, "Courier New", monospace',
    color: '#1f2937'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>🎨 UI 블록 시각화</h1>
        <p style={subtitleStyle}>생성된 UI 블록의 실제 렌더링 결과를 확인하세요</p>
      </div>

      <div style={controlsStyle}>
        <input
          type="text"
          placeholder="블록 ID 입력 (예: block4-2)"
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
          onKeyPress={handleKeyPress}
          style={inputStyle}
          disabled={loading}
        />
        <button 
          onClick={fetchBlockData} 
          disabled={loading || !blockId.trim()}
          style={buttonStyle}
        >
          {loading ? '로딩 중...' : '렌더링'}
        </button>
      </div>

      {error && (
        <div style={errorStyle}>
          ⚠️ {error}
        </div>
      )}

      {blockData && (
        <div>
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>📊 블록 정보</h4>
            <div style={infoGridStyle}>
              <div style={{ color: '#1f2937' }}>
                <strong>요약:</strong> {blockData.summary}
              </div>
              <div style={{ color: '#1f2937' }}>
                <strong>생성 시간:</strong> {new Date(blockData.createdAt).toLocaleString()}
              </div>
              <div style={{ color: '#1f2937' }}>
                <strong>성공 여부:</strong> {blockData.success ? '✅ 성공' : '❌ 실패'}
              </div>
              <div style={{ color: '#1f2937' }}>
                <strong>블록 ID:</strong> {blockData.blockId}
              </div>
            </div>
          </div>
          
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>💬 입력 프롬프트</h4>
            <div style={promptStyle}>
              {blockData.inputPrompt}
            </div>
          </div>
          
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>⚙️ 속성값</h4>
            <pre style={codeBlockStyle}>
              {JSON.stringify(blockData.property, null, 2)}
            </pre>
          </div>
          
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>🎨 렌더링 결과</h4>
            <BlockRenderer 
              code={blockData.code}
              property={blockData.property}
              blockId={blockData.blockId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeVisualization;