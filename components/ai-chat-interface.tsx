"use client"

import React, { useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Send,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AIChatInterface({ projectId }: { projectId: string }) {
  // projectId is reserved for future implementation
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    
    // Stub functionality to simulate chat
    setTimeout(() => {
      setIsLoading(false)
      setInput("")
    }, 500)
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 overflow-y-auto custom-scrollbar">
        {!isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
                Hi {userName},
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                What are we building?
              </h2>
            </div>
          </div>
        )}
      </div>

      <div className="w-full pb-8 sm:pb-12 shrink-0">
        <div className="w-full max-w-2xl mx-auto px-3 sm:px-4">
          <div className="relative group">
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-end gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
              <div className="flex-1 flex flex-col gap-1 min-h-0">
                <textarea
                  placeholder="Describe the website you want to build..."
                  className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none px-3 py-2 min-h-[40px] max-h-32"
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                  }}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button 
                  onClick={handleSend} 
                  className={cn("h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 shadow-none rounded-lg p-0", input.trim() && !isLoading ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800/50 text-zinc-700")} 
                  disabled={!input.trim() || isLoading}
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-zinc-700" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
