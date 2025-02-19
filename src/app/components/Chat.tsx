'use client';

import { useChat } from 'ai/react';
import { Message } from 'ai';
import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ComponentPropsWithoutRef } from 'react';

interface StreamingState {
  thinking: string;
  content: string;
  isThinking: boolean;
}

function parseMessage(content: string) {
  const thinkRegex = /<think>([^]*?)<\/think>/;
  const thinkMatch = content.match(thinkRegex);
  
  if (thinkMatch) {
    return {
      thinking: thinkMatch[1].trim(),
      content: content.replace(thinkRegex, '').trim()
    };
  }
  return { content: content.trim() };
}

// Define proper types for our components
type CodeProps = ComponentPropsWithoutRef<'code'> & { inline?: boolean };
type PreProps = ComponentPropsWithoutRef<'pre'>;
type ParagraphProps = ComponentPropsWithoutRef<'p'>;

function formatThinkingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 
    ? `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} seconds`
    : `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

export default function Chat() {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    thinking: '',
    content: '',
    isThinking: true
  });
  
  const [isOpen, setIsOpen] = useState(true);
  const thinkingStartTime = useRef<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/deepseek/chat',
    onFinish: () => {
      setStreamingState({
        thinking: '',
        content: '',
        isThinking: true
      });
      thinkingStartTime.current = null;
    }
  });

  // Handle streaming content
  useEffect(() => {
    if (!messages.length) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    const content = lastMessage.content;
    const thinkRegex = /<think>([^]*?)<\/think>/;
    const thinkMatch = content.match(thinkRegex);
    
    // Start timing when we first see <think>
    if (content.includes('<think>') && !thinkingStartTime.current) {
      thinkingStartTime.current = Date.now();
    }
    
    if (thinkMatch) {
      setStreamingState({
        thinking: thinkMatch[1].trim(),
        content: content.replace(thinkRegex, '').trim(),
        isThinking: false
      });
      thinkingStartTime.current = null;
    } else if (content.includes('<think>')) {
      setStreamingState({
        thinking: content.replace('<think>', '').trim(),
        content: '',
        isThinking: true
      });
    } else if (streamingState.isThinking) {
      setStreamingState(prev => ({
        ...prev,
        thinking: content.trim()
      }));
    } else {
      setStreamingState(prev => ({
        ...prev,
        content: content.trim()
      }));
    }
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Optimize scroll behavior
  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Scroll on content updates
  useEffect(() => {
    if (streamingState.content || streamingState.thinking) {
      scrollToBottom();
    }
  }, [streamingState.content, streamingState.thinking, scrollToBottom]);

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Right side box */}
      <div className="fixed top-0 right-0 w-[12%] h-24 bg-black z-10" />
      
      {/* Title */}
      <div className="fixed top-6 left-7 text-4xl font-regular text-gray-200 font-mono z-20">
        SandyAI
      </div>

      {/* Chat messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 pb-32 pt-24"
      >
        <div className="max-w-[55%] mx-auto space-y-6">
          {messages.map((message, i) => {
            const isLastMessage = i === messages.length - 1;
            const parsedContent = message.role === 'assistant' 
              ? parseMessage(message.content)
              : { content: message.content };

            if (message.role === 'assistant' && isLastMessage && (streamingState.thinking || streamingState.content)) {
              return (
                <div key={i} className="flex flex-col">
                  {streamingState.thinking && (
                    <details 
                      className="mb-4" 
                      open={isOpen}
                      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
                    >
                      <summary className="cursor-pointer text-sm text-white p-2 hover:bg-neutral-800 rounded-none transition-colors flex items-center gap-2 select-none font-mono border-2 border-white">
                        <svg 
                          className={`w-3 h-3 transform transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>
                          {streamingState.content ? 'Thoughts' : 'Thinking'}
                        </span>
                      </summary>
                      <div className="mt-2 text-sm text-gray-400 pl-4 border-l-2 border-white">
                        <div className="prose prose-invert prose-thinking max-w-none font-mono">
                          <ReactMarkdown className="whitespace-pre-wrap">
                            {streamingState.thinking}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </details>
                  )}
                  {streamingState.content && (
                    <div className="prose prose-invert prose-response max-w-none font-mono text-gray-300">
                      <ReactMarkdown
                        components={{
                          p: ({ children }: ParagraphProps) => (
                            <p className="whitespace-pre-wrap">{children}</p>
                          ),
                          pre: ({ children }: PreProps) => (
                            <div className="overflow-auto my-4 p-2 bg-gray-800 rounded">
                              <pre className="text-gray-100">{children}</pre>
                            </div>
                          ),
                          code: ({ inline, className, children }: CodeProps) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return inline ? (
                              <code className="bg-gray-800 text-gray-100 rounded px-1">{children}</code>
                            ) : (
                              <pre className="overflow-auto my-4 p-2 bg-gray-800 rounded">
                                <code className={className}>{children}</code>
                              </pre>
                            );
                          },
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 my-2">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 my-2">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="my-1">{children}</li>
                          )
                        }}
                      >
                        {streamingState.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            }

            if (message.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-2 bg-white text-black font-mono font-bold">
                    {message.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex flex-col">
                {parsedContent.thinking && (
                  <details 
                    className="mb-4" 
                    open={isOpen}
                    onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
                  >
                    <summary className="cursor-pointer text-sm text-white p-2 hover:bg-neutral-800 rounded-none transition-colors flex items-center gap-2 select-none font-mono border-2 border-white">
                      <svg 
                        className={`w-3 h-3 transform transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>Thoughts</span>
                    </summary>
                    <div className="mt-2 text-sm text-gray-400 pl-4 border-l-2 border-white">
                      <div className="prose prose-invert prose-thinking max-w-none font-mono">
                        <ReactMarkdown className="whitespace-pre-wrap">
                          {parsedContent.thinking}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </details>
                )}
                <div className="prose prose-invert prose-response max-w-none font-mono text-gray-300">
                  <ReactMarkdown
                    components={{
                      p: ({ children }: ParagraphProps) => (
                        <p className="whitespace-pre-wrap">{children}</p>
                      ),
                      pre: ({ children }: PreProps) => (
                        <div className="overflow-auto my-4 p-2 bg-gray-800 rounded">
                          <pre className="text-gray-100">{children}</pre>
                        </div>
                      ),
                      code: ({ inline, className, children }: CodeProps) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return inline ? (
                          <code className="bg-gray-800 text-gray-100 rounded px-1">{children}</code>
                        ) : (
                          <pre className="overflow-auto my-4 p-2 bg-gray-800 rounded">
                            <code className={className}>{children}</code>
                          </pre>
                        );
                      },
                      ul: ({ children }) => (
                        <ul className="list-disc pl-4 my-2">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-4 my-2">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="my-1">{children}</li>
                      )
                    }}
                  >
                    {parsedContent.content}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      {/* Floating Input form with solid background */}
      <div className={`transition-all duration-500 ease-in-out ${
        messages.length === 0 
          ? 'fixed top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-[45%]' 
          : 'fixed bottom-0 left-0 right-0 px-4 py-6 bg-black'
      }`}>
        <div className={messages.length > 0 ? 'max-w-[60%] mx-auto' : 'w-full'}>
          {messages.length === 0 && (
            <h1 className="text-4xl text-gray-300 font-light text-center mb-8 font-mono">
              Hi, I'm your Local AI Assistant.
            </h1>
          )}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder={messages.length === 0 ? "What do you want to know?" : "Ask anything..."}
                className="w-full p-4 pr-16 bg-transparent text-white font-mono border-2 border-white focus:outline-none focus:border-white placeholder-white/60"
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`absolute right-3 top-1/2 -translate-y-1/2 px-3.5 py-2 bg-transparent border border-white transition-colors ${
                  isLoading 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-white group'
                }`}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  className={`text-white -rotate-90 ${!isLoading && 'group-hover:text-black'}`}
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M14 5l7 7-7 7"
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M21 12H3"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 