import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAtom } from 'jotai'
import { Bot, ChevronLeft, Send, Trash2, Square, X } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from "sonner"
import { chatMessagesAtom, addChatMessageAtom, clearChatMessagesAtom, isAIResponseLoadingAtom } from "@/store/ai"
import { appSettingsAtom } from "@/store/appSettings"

// 优化的Markdown渲染函数 - 更好支持中文
const renderMarkdown = (content: string) => {
  let html = content
    // 代码块 - 支持中文注释
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-content3 p-3 rounded-lg overflow-x-auto my-2 font-mono"><code class="text-sm whitespace-pre-wrap">$2</code></pre>')
    // 行内代码 - 优化中文显示
    .replace(/`([^`]+)`/g, '<code class="bg-content3 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    // 粗体 - 支持中文
    .replace(/\*\*([\s\S]*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // 斜体 - 支持中文
    .replace(/\*([\s\S]*?)\*/g, '<em class="italic">$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // 标题 - 优化中文排版
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2 text-foreground">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2 text-foreground">$1</h1>')
    // 有序列表
    .replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 list-decimal mb-1">$1</li>')
    // 无序列表
    .replace(/^[-*]\s+(.*$)/gm, '<li class="ml-4 list-disc mb-1">$1</li>')
    // 引用块
    .replace(/^>\s*(.*$)/gm, '<blockquote class="border-l-4 border-primary pl-4 my-2 text-default-600 italic">$1</blockquote>')
    // 分隔线
    .replace(/^---$/gm, '<hr class="my-4 border-divider" />')
    // 换行 - 保持段落结构
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')

  // 包装段落
  if (html && !html.startsWith('<')) {
    html = '<p class="mb-2">' + html + '</p>'
  }

  return html
}

export function AIPanel({ onClose }: { onClose: () => void }) {
  const [appSettings] = useAtom(appSettingsAtom)
  const [chatMessages] = useAtom(chatMessagesAtom)
  const [, addChatMessage] = useAtom(addChatMessageAtom)
  const [, clearChatMessages] = useAtom(clearChatMessagesAtom)
  const [isLoading, setIsLoading] = useAtom(isAIResponseLoadingAtom)

  const [inputValue, setInputValue] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 打字机效果相关状态
  const [typingMessage, setTypingMessage] = useState<{
    id: string
    content: string
    displayedContent: string
    isTyping: boolean
  } | null>(null)
  const typingIntervalRef = useRef<any>(null)

  // 智能滚动相关状态
  const userHasScrolledRef = useRef(false)
  const lastScrollTop = useRef(0)

  // 中断控制
  const [, setIsInterrupted] = useState(false)
  const isInterruptedRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 智能滚动到底部
  const scrollToBottom = () => {
    const viewport = scrollViewportRef.current
    if (viewport && (!userHasScrolledRef.current)) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }

  // 检测用户是否手动滚动
  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const isAtBottom = (scrollTop + clientHeight >= scrollHeight - 5) // 5px容差

      // 如果用户滚动到底部附近，重置为自动滚动模式
      if (isAtBottom) {
        userHasScrolledRef.current = false;
      } else if (scrollTop < lastScrollTop.current) {
        // 用户向上滚动
        userHasScrolledRef.current = true;
      }

      lastScrollTop.current = scrollTop
    }
  }, [])

  // 聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // 获取 ScrollArea 的 viewport 元素并设置滚动监听
  useEffect(() => {
    if (!scrollAreaRef.current) return

    // 查找 ScrollArea 内部的 viewport 元素
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement
    if (!viewport) return

    if (scrollViewportRef.current !== viewport) {
      ;(scrollViewportRef as React.MutableRefObject<HTMLDivElement | null>).current = viewport
    }
    
    // 添加滚动监听器
    viewport.addEventListener('scroll', handleScroll)
    
    // 清理函数
    return () => {
      viewport.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // 清理打字机定时器
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // 中断AI输出
  const handleInterrupt = () => {
    setIsInterrupted(true)
    isInterruptedRef.current = true

    // 中断网络请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 停止打字机效果
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current)
      typingIntervalRef.current = null
    }

    // 如果有正在显示的消息，添加到聊天记录
    if (typingMessage && typingMessage.displayedContent.trim()) {
      addChatMessage({
        role: 'assistant',
        content: typingMessage.displayedContent + '\n\n[输出已中断]'
      })
    }

    // 清理状态
    setTypingMessage(null)
    setIsLoading(false)

    // 延迟重置中断状态，确保组件状态更新完成
    setTimeout(() => {
      setIsInterrupted(false)
      isInterruptedRef.current = false
    }, 500)

    toast.info('AI输出已中断')
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    if (!appSettings?.ai?.enabled || !appSettings?.ai?.apiKey) {
      toast.error('请先在设置中配置AI API')
      return
    }

    const userMessage = inputValue.trim()
    setInputValue('')

    // 重置用户滚动状态，确保AI输出时可以自动滚动
    userHasScrolledRef.current = false;

    // 添加用户消息
    addChatMessage({
      role: 'user',
      content: userMessage
    })
    scrollToBottom()
    setIsLoading(true)
    setIsInterrupted(false)
    isInterruptedRef.current = false

    // 创建AbortController用于中断请求
    abortControllerRef.current = new AbortController()

    try {
      // 构建系统提示词 - 优化中文处理
      let systemPrompt = '你是一个专业的游戏资源助手，专门帮助用户分析和修改各种游戏资源。请用清晰、准确的中文回答，并在适当时提供具体的代码示例。'

      if (true) {
        // 限制文件内容大小为150,000字符
        const MAX_CONTENT_LENGTH = 150000;
        
        // 递归函数，确保内容不超过指定长度
        const truncateContent = (content: string, maxLength: number): string => {
          if (content.length <= maxLength) {
            return content;
          }
          
          // 按换行符分割文本
          const lines = content.split('\n');
          
          // 如果只有少量行，直接从中间截取
          if (lines.length <= 10) {
            return content.substring(0, maxLength / 2) + 
             '\n\n...[内容过长，中间部分已省略]...\n\n' +
             content.substring(content.length - maxLength / 2);
          }
          
          // 保留头部和尾部的一些内容
          const headLines = lines.slice(0, Math.floor(lines.length * 0.4));
          const tailLines = lines.slice(Math.floor(lines.length * 0.6));
          
          // 组合新内容
          const newContent = [
            ...headLines,
            '\n...[内容过长，中间部分已省略]...\n',
            ...tailLines
          ].join('\n');
          
          // 如果还是太长，递归处理
          if (newContent.length > maxLength) {
            return truncateContent(newContent, maxLength);
          }
          
          return newContent;
        };
        
        systemPrompt += '\n\n请基于这个游戏资源的内容来回答用户的问题，提供准确的配置建议和解释。'
      }

      // 准备消息历史
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ]

      // 根据provider调用不同的API
      let apiUrl = appSettings.ai?.baseUrl || 'https://api.openai.com/v1'
      let headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${appSettings.ai?.apiKey || ''}`
      }

      if (appSettings.ai?.provider === 'deepseek') {
        apiUrl = apiUrl || 'https://api.deepseek.com/v1'
      } else if (appSettings.ai?.provider === 'openai') {
        apiUrl = apiUrl || 'https://api.openai.com/v1'
      }

      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          model: appSettings.ai?.model || 'gpt-3.5-turbo',
          messages,
          temperature: 0.7,
          max_tokens: 3000,
          stream: true, // 启用流式输出
          // 优化中文处理
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        })
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let messageContent = ''
      let messageId = Date.now().toString()

      // 初始化流式打字效果
      setTypingMessage({
        id: messageId,
        content: '',
        displayedContent: '',
        isTyping: true
      })

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            break
          }

          // 检查是否被中断
          if (isInterruptedRef.current) {
            reader.cancel()
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.trim() === '') continue
            if (line.trim() === 'data: [DONE]') continue

            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6) // 移除 "data: " 前缀
                const data = JSON.parse(jsonStr)

                if (data.choices && data.choices[0] && data.choices[0].delta) {
                  const delta = data.choices[0].delta
                  if (delta.content) {
                    messageContent += delta.content
                    
                    // 实时更新显示内容
                    setTypingMessage(prev => prev ? {
                      ...prev,
                      content: messageContent,
                      displayedContent: messageContent
                    } : null)

                    // 实时滚动到底部
                    setTimeout(() => {
                      scrollToBottom()
                    }, 0)
                  }
                }
              } catch (parseError) {
                console.warn('解析流式数据失败:', parseError, '原始数据:', line)
                // 继续处理下一行，不中断整个流程
              }
            }
          }
        }

        // 流式输出完成
        if (messageContent.trim() && !isInterruptedRef.current) {
          setTypingMessage(prev => prev ? {
            ...prev,
            isTyping: false
          } : null)

          // 延迟后将消息添加到正式聊天记录
          setTimeout(() => {
            addChatMessage({
              role: 'assistant',
              content: messageContent
            })
            setTypingMessage(null)
          }, 300)
        }

      } catch (streamError) {
        console.error('流式读取错误:', streamError)
        throw streamError
      } finally {
        reader.releaseLock()
      }

    } catch (error) {
      // 检查是否是用户主动中断
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('AI请求被用户中断')
        return
      }

      console.error('AI API调用失败:', error)
      
      // 错误消息直接显示，不使用流式效果
      const errorMessage = `抱歉，AI服务暂时不可用：${error instanceof Error ? error.message : '未知错误'}`
      
      // 直接添加错误消息到聊天记录
      addChatMessage({
        role: 'assistant',
        content: errorMessage
      })
      
      toast.error('AI请求失败，请检查API配置')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 检查是否是Escape键，用于中断AI输出
    if (e.key === 'Escape' && (isLoading || typingMessage)) {
      e.preventDefault()
      handleInterrupt()
      return
    }

    // 检查是否是回车键且没有按住shift
    if (e.key === 'Enter' && !e.shiftKey) {
      // 检查输入法状态 - 如果正在使用输入法，不发送消息
      if (e.nativeEvent.isComposing) {
        return
      }

      e.preventDefault()
      handleSend()
    }
  }

  // 处理输入法组合事件
  const handleCompositionStart = () => {
    // 输入法开始时，标记状态
  }

  const handleCompositionEnd = () => {
    // 输入法结束时，清除标记
  }

  const handleClearChat = () => {
    // 如果AI正在输出，先中断
    if (isLoading || typingMessage) {
      handleInterrupt()
    }

    // 清除聊天记录
    clearChatMessages()
    toast.success('聊天记录已清空')
  }

  return (
    <div className="flex flex-col h-full bg-content1">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-divider">
        <div className="flex items-center space-x-2">
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="h-7 text-default-500 hover:text-foreground hover:bg-content2 heroui-transition"
          >
            <X className="h-4 w-4" />
          </Button>
          <h2 className="text-[15px] font-semibold">AI 助手</h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleClearChat}
            size="sm"
            variant="ghost"
            className="h-7 text-default-500 hover:text-foreground hover:bg-content2 heroui-transition"
            disabled={chatMessages.length === 0 && !isLoading && !typingMessage}
            title={isLoading || typingMessage ? "中断AI输出并清空" : "清空聊天记录"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AI状态指示器 */}
      {(isLoading || typingMessage) && (
        <div className="px-4 py-2 bg-warning/10 border-b border-divider">
          <div className="flex items-center space-x-2 text-xs text-warning-600">
            <div className="animate-pulse w-2 h-2 bg-warning rounded-full"></div>
            <span>
              {isLoading && !typingMessage ? 'AI正在思考...' : 'AI正在回复...'}
            </span>
            <span className="text-default-400">按Esc键或点击中断按钮可中断</span>
          </div>
        </div>
      )}

      {/* 聊天区域 */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="h-12 w-12 text-default-300 mb-4" />
            <h3 className="text-lg font-medium text-default-500 mb-2">AI 配置助手</h3>
            <p className="text-sm text-default-400 max-w-sm leading-relaxed">
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-content2 text-foreground'
                    }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.role === 'assistant' ? (
                      <div
                        className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-code:text-foreground"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />
                    ) : (
                      <div className="break-words">{message.content}</div>
                    )}
                  </div>
                  <div className={`text-xs mt-2 opacity-70 ${message.role === 'user' ? 'text-primary-foreground' : 'text-default-500'
                    }`}>
                    {message.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* 打字机效果消息 */}
            {typingMessage && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-content2 text-foreground rounded-lg p-3">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    <div
                      className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-code:text-foreground"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(typingMessage.displayedContent) }}
                    />
                    {typingMessage.isTyping && (
                      <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs mt-2 opacity-70 text-default-500">
                    {typingMessage.isTyping ? '正在输入...' : new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}

            {isLoading && !typingMessage && (
              <div className="flex justify-start">
                <div className="bg-content2 text-foreground rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    <span className="text-sm">AI正在思考...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <Separator />

      {/* 输入区域 */}
      <div className="p-4">
        <div className="relative">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={"请先在设置中配置AI服务..."}
            disabled={!appSettings?.ai?.enabled || isLoading}
            className="w-full bg-content2 border-divider focus:border-primary heroui-transition min-h-[80px] max-h-[200px] resize-none pr-12 pb-12"
            rows={3}
          />
          <Button
            onClick={isLoading || typingMessage ? handleInterrupt : handleSend}
            disabled={(!inputValue.trim() && !isLoading && !typingMessage) || !appSettings?.ai?.enabled}
            size="sm"
            className={`absolute bottom-2 right-2 h-8 w-8 p-0 ${isLoading || typingMessage
                ? 'heroui-button heroui-button-danger bg-danger hover:bg-danger/90'
                : 'heroui-button heroui-button-primary'
              }`}
            title={isLoading || typingMessage ? "中断AI输出" : "发送消息"}
          >
            {isLoading || typingMessage ? (
              <Square className="h-3 w-3" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
        {!appSettings?.ai?.enabled && (
          <div className="text-xs text-warning mt-2">
            ⚠️ AI功能未启用，请在设置中配置API后启用
          </div>
        )}
      </div>
    </div>
  )
}
