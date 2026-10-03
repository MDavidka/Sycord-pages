"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { AstroChatProps, ChatMessage, Plan, PreviewState, ToolCallItem, QuestionItem } from "./types"
import { ChatView } from "./ChatView"
import { PreviewPane } from "./PreviewPane"
import { runAstroChatTurn, executeWorkspaceTool } from "./stream"
import { ArrowLeft, Split, Monitor, MessageSquare, Play, Sparkles } from "lucide-react"

export default function AstroChat({
  projectId = "",
  projectName,
  userImage,
  onBack,
  initialModel = "gemini-2.5-flash",
}: AstroChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<string>(initialModel)
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [currentThinking, setCurrentThinking] = useState<string>("")
  const [thinkingDuration, setThinkingDuration] = useState<number>(0)
  const [activePlan, setActivePlan] = useState<Plan | undefined>()
  const [previewState, setPreviewState] = useState<PreviewState>({
    status: "idle",
    url: null,
  })

  // Active view: "split" (both side-by-side on desktop), "chat", or "preview"
  const [activeTab, setActiveTab] = useState<"chat" | "preview">("chat")
  const [showPreviewOnDesktop, setShowPreviewOnDesktop] = useState<boolean>(true)

  const abortControllerRef = useRef<AbortController | null>(null)

  // 1. Load initial preview state & chat messages
  useEffect(() => {
    if (!projectId) return

    // Load preview status
    fetch(`/api/workspace/preview?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.previewUrl) {
          setPreviewState({
            status: data.previewReady ? "running" : "starting",
            url: data.previewUrl,
            directUrl: data.preview_direct_url || null,
            port: data.preview_port || null,
            domain: data.preview_domain || null,
          })
        }
      })
      .catch(() => {})

    // Load persisted chat history
    fetch(`/api/projects/${encodeURIComponent(projectId)}/chat`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          const parsed = data.messages.map((m: any, idx: number) => ({
            id: m.id || `msg_${idx}`,
            role: m.role || "user",
            content: m.content || "",
            timestamp: m.timestamp || Date.now(),
            plan: m.plan,
            toolCalls: m.toolCalls,
            previewUrl: m.previewUrl,
          }))
          setMessages(parsed)
          // Look for any last active plan
          for (let i = parsed.length - 1; i >= 0; i--) {
            if (parsed[i].plan) {
              setActivePlan(parsed[i].plan)
              break
            }
          }
        }
      })
      .catch(() => {})
  }, [projectId])

  // Save chat messages to DB
  const persistChatMessages = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!projectId || msgs.length === 0) return
      try {
        await fetch(`/api/projects/${encodeURIComponent(projectId)}/chat`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              plan: m.plan,
              toolCalls: m.toolCalls,
              previewUrl: m.previewUrl,
            })),
          }),
        })
      } catch {}
    },
    [projectId]
  )

  // Start preview dev server
  const handleStartDevServer = useCallback(async () => {
    if (!projectId) return
    setPreviewState((prev) => ({ ...prev, status: "starting" }))
    setShowPreviewOnDesktop(true)
    setActiveTab("preview")

    try {
      const res = await fetch(`/api/workspace/preview?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.previewUrl) {
        setPreviewState({
          status: "running",
          url: data.previewUrl,
          directUrl: data.preview_direct_url || null,
          port: data.preview_port || null,
          domain: data.preview_domain || null,
        })
      } else {
        setPreviewState({
          status: "error",
          url: data?.previewUrl || null,
          error: data?.error || "Failed to start preview dev server",
        })
      }
    } catch (e: any) {
      setPreviewState({
        status: "error",
        url: null,
        error: e?.message || "Network error starting preview",
      })
    }
  }, [projectId])

  // Stop Generation
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  // Clear Chat
  const handleClearChat = useCallback(() => {
    if (confirm("Are you sure you want to clear this conversation?")) {
      setMessages([])
      setActivePlan(undefined)
      if (projectId) {
        fetch(`/api/projects/${encodeURIComponent(projectId)}/chat`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [] }),
        }).catch(() => {})
      }
    }
  }, [projectId])

  // Interactive Question Answered
  const handleQuestionAnswered = useCallback((questionId: string, answer: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.question?.id === questionId
          ? { ...m, question: { ...m.question, answer } }
          : m
      )
    )
    // Send answer as next user turn
    handleSendMessage(`[Answer to ${questionId}]: ${answer}`)
  }, [])

  // Send Message & Autonomous Execution Loop
  const handleSendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: `usr_${Date.now()}`,
        role: "user",
        content: userText,
        timestamp: Date.now(),
      }

      const updatedHistory = [...messages, userMsg]
      setMessages(updatedHistory)
      setIsStreaming(true)
      setCurrentThinking("")
      setThinkingDuration(0)

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const assistantMsgId = `ast_${Date.now()}`
      let currentAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
        toolCalls: [],
      }

      setMessages((prev) => [...prev, currentAssistantMsg])

      // Working conversation array for AI turns
      const conversation: Array<{
        role: string
        content: string
        tool_calls?: any[]
        tool_call_id?: string
      }> = updatedHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      let turnCount = 0
      const MAX_AUTONOMOUS_TURNS = 15

      try {
        while (turnCount < MAX_AUTONOMOUS_TURNS) {
          if (abortController.signal.aborted) break
          turnCount++

          let turnContentAccum = ""
          let turnThinkingAccum = ""

          const turnResult = await runAstroChatTurn(
            projectId,
            selectedModel,
            conversation,
            {
              onTokenDelta: (delta) => {
                turnContentAccum += delta
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + delta, isStreaming: true }
                      : m
                  )
                )
              },
              onThinkingDelta: (delta) => {
                turnThinkingAccum += delta
                setCurrentThinking((prev) => prev + delta)
              },
              onThinkingDone: (dur) => {
                if (dur) setThinkingDuration(dur)
              },
              onToolCallStart: (tool) => {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m
                    const existing = m.toolCalls || []
                    const found = existing.some((t) => t.id === tool.id)
                    return {
                      ...m,
                      toolCalls: found
                        ? existing.map((t) => (t.id === tool.id ? tool : t))
                        : [...existing, tool],
                    }
                  })
                )
              },
              onToolCallDone: (tool) => {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantMsgId) return m
                    return {
                      ...m,
                      toolCalls: (m.toolCalls || []).map((t) =>
                        t.id === tool.id ? tool : t
                      ),
                    }
                  })
                )
              },
              onPlan: (plan) => {
                setActivePlan(plan)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, plan } : m
                  )
                )
              },
              onPlanUpdate: (stepId, status, notes) => {
                setActivePlan((prev) => {
                  if (!prev) return prev
                  const nextSteps = prev.steps.map((s) =>
                    s.id === stepId ? { ...s, status, notes: notes || s.notes } : s
                  )
                  return { ...prev, steps: nextSteps }
                })
              },
              onQuestion: (question) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, question } : m
                  )
                )
              },
              onPreviewReady: (prev) => {
                setPreviewState({
                  status: "running",
                  url: prev.url,
                  port: prev.port || null,
                  domain: prev.domain || null,
                })
                setShowPreviewOnDesktop(true)
                setMessages((prevMsgs) =>
                  prevMsgs.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, previewUrl: prev.url }
                      : m
                  )
                )
              },
              onError: (err) => {
                console.error("[AstroChat] stream error:", err)
              },
              onDone: () => {},
            },
            abortController.signal
          )

          // If turn produced tool calls, execute them and continue the autonomous loop
          if (turnResult.toolCalls && turnResult.toolCalls.length > 0) {
            conversation.push({
              role: "assistant",
              content: turnResult.assistantContent || "",
              tool_calls: turnResult.toolCalls.map((t) => ({
                id: t.id,
                type: "function",
                function: {
                  name: t.name,
                  arguments: JSON.stringify(t.args || {}),
                },
              })),
            })

            // Execute each tool call
            for (const tool of turnResult.toolCalls) {
              const execRes = await executeWorkspaceTool(projectId, tool.name, tool.args)
              tool.result = execRes
              tool.status = execRes.ok !== false ? "completed" : "failed"

              // If start_preview was called, update preview state
              if (tool.name.includes("preview") && execRes.preview_url) {
                setPreviewState({
                  status: "running",
                  url: execRes.preview_url,
                  port: execRes.preview_port || null,
                  domain: execRes.preview_domain || null,
                })
                setShowPreviewOnDesktop(true)
              }

              conversation.push({
                role: "tool",
                tool_call_id: tool.id,
                content: JSON.stringify(execRes),
              })
            }

            // Update UI with finished tool call results
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      toolCalls: turnResult.toolCalls,
                      previewUrl: turnResult.previewUrl || m.previewUrl,
                    }
                  : m
              )
            )

            // Continue while loop to get assistant's summary or next actions
            continue
          }

          // If no tool calls and turn completed naturally, break out of loop
          break
        }
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          console.error("[AstroChat] Execution error:", err)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content:
                      m.content +
                      `\n\n> ⚠️ Error during execution: ${err?.message || "Unknown error"}`,
                  }
                : m
            )
          )
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null

        // Mark message as finished streaming
        setMessages((prev) => {
          const final = prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
          persistChatMessages(final)
          return final
        })
      }
    },
    [messages, isStreaming, selectedModel, projectId, persistChatMessages]
  )

  const handleOpenPreview = useCallback((url?: string) => {
    if (url) {
      setPreviewState((prev) => ({ ...prev, status: "running", url }))
    }
    setShowPreviewOnDesktop(true)
    setActiveTab("preview")
  }, [])

  return (
    <div className="flex flex-col h-full w-full bg-[#121214] text-zinc-100 overflow-hidden select-none">
      {/* Mobile Top Navigation */}
      <div className="flex md:hidden items-center justify-between px-3 py-2 border-b border-zinc-800 bg-[#18181b] z-20">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        )}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "chat" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "preview" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Preview</span>
            {previewState.status === "running" && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 w-full flex overflow-hidden">
        {/* Chat Pane */}
        <div
          className={`h-full flex flex-col transition-all duration-200 ${
            // Mobile visibility
            activeTab === "chat" ? "flex w-full" : "hidden md:flex"
          } ${
            // Desktop split calculation
            showPreviewOnDesktop ? "md:w-[48%] md:border-r border-zinc-800" : "md:w-full"
          }`}
        >
          <ChatView
            messages={messages}
            isStreaming={isStreaming}
            currentThinking={currentThinking}
            thinkingDuration={thinkingDuration}
            activePlan={activePlan}
            previewState={previewState}
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onClearChat={handleClearChat}
            onQuestionAnswered={handleQuestionAnswered}
            onOpenPreview={handleOpenPreview}
            onStartDevServer={handleStartDevServer}
            projectName={projectName}
            userImage={userImage}
            isDark={true}
          />
        </div>

        {/* Live Preview Pane */}
        <div
          className={`h-full flex flex-col transition-all duration-200 ${
            // Mobile visibility
            activeTab === "preview" ? "flex w-full" : "hidden md:flex"
          } ${
            // Desktop visibility
            showPreviewOnDesktop ? "md:w-[52%]" : "md:hidden"
          }`}
        >
          <PreviewPane
            projectId={projectId}
            previewState={previewState}
            onStartRequested={handleStartDevServer}
            isDark={true}
          />
        </div>
      </div>
    </div>
  )
}
