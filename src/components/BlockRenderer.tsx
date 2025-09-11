import React, { useEffect, useState } from 'react';
import Handlebars from 'handlebars';

interface BlockRendererProps {
  code: string;
  property: any;
  blockId: string;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({ code, property, blockId }) => {
  const [renderedHtml, setRenderedHtml] = useState('');
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    try {
      setRenderError('');
      
      // 1. 코드에서 각 섹션 분리
      const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/);
      const template = templateMatch?.[1] || '';

      // 2. Handlebars 템플릿 컴파일 및 렌더링
      const compiledTemplate = Handlebars.compile(template);
      const html = compiledTemplate(property);
      
      setRenderedHtml(html);
      
    } catch (error) {
      console.error('블록 렌더링 오류:', error);
      setRenderError(`렌더링 오류: ${(error as Error).message}`);
      setRenderedHtml('<div class="error">렌더링 오류가 발생했습니다.</div>');
    }
  }, [code, property]);

  // 3. 완전한 HTML 문서 생성
  const styleMatch = code.match(/<style>([\s\S]*?)<\/style>/);
  const scriptMatch = code.match(/<script>([\s\S]*?)<\/script>/);
  
  const style = styleMatch?.[1] || '';
  const script = scriptMatch?.[1] || '';

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          ${style}
          body { 
            margin: 20px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6;
          }
          .error {
            color: #dc3545;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        ${renderedHtml}
        <script>
          // 웹빌더 전용 객체를 브라우저 표준으로 대체
          const bm = {
            container: document.body,
            context: window
          };
          
          // 원본 스크립트 실행
          try {
            ${script.replace(/const container = bm\.container;?/g, 'const container = document.body;')}
          } catch (error) {
            console.warn('스크립트 실행 오류:', error);
          }
        </script>
      </body>
    </html>
  `;

  const blockInfoStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 8px 0', 
    fontSize: '18px', 
    color: '#333'
  };

  const errorStyle: React.CSSProperties = {
    color: '#dc3545', 
    background: '#f8d7da', 
    padding: '8px 12px', 
    borderRadius: '4px',
    fontSize: '14px'
  };

  const iframeStyle: React.CSSProperties = {
    width: '100%', 
    height: '400px', 
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    background: '#fff'
  };

  return (
    <div className="block-renderer">
      <div style={blockInfoStyle}>
        <h3 style={titleStyle}>
          블록 ID: {blockId}
        </h3>
        {renderError && (
          <div style={errorStyle}>
            {renderError}
          </div>
        )}
      </div>
      
      <iframe 
        srcDoc={fullHtml}
        style={iframeStyle}
        sandbox="allow-scripts allow-same-origin"
        title={`Block ${blockId} Preview`}
      />
    </div>
  );
};

export default BlockRenderer;