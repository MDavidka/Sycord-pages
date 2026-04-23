"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AIGenerator } from "@/components/generator"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Code, Copy, Download } from "lucide-react"
import { toast } from "sonner"

export default function GeneratorPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [pageId, setPageId] = useState<string | null>(null)

  const handleGenerated = (tsx: string, generatedPageId: string) => {
    setGeneratedCode(tsx)
    setPageId(generatedPageId)
  }

  const copyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
      toast.success("Code copied to clipboard")
    }
  }

  const downloadCode = () => {
    if (generatedCode && pageId) {
      const blob = new Blob([generatedCode], { type: "text/typescript" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${pageId}.tsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("File downloaded")
    }
  }

  return (
    <div className="min-h-screen bg-[#101010]">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 bg-[#101010]/95 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={28} height={28} />
              <span className="text-lg font-semibold text-white">Sycord</span>
            </Link>
            <Badge 
              variant="outline" 
              className="text-[10px] px-2 py-0 h-5 bg-purple-500/10 text-purple-400 border-purple-500/20 font-semibold rounded-full"
            >
              Generator v2
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
          {/* Generator Panel */}
          <div className="h-full">
            <AIGenerator onGenerated={handleGenerated} />
          </div>

          {/* Output Panel */}
          <div className="h-full flex flex-col bg-[#101010] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-medium text-white">Generated Output</h3>
                {pageId && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-2 py-0 h-5 bg-white/5 text-white/50 border-white/10 font-mono"
                  >
                    {pageId}.tsx
                  </Badge>
                )}
              </div>
              {generatedCode && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyCode}
                    className="h-7 text-xs text-white/40 hover:text-white"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadCode}
                    className="h-7 text-xs text-white/40 hover:text-white"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {generatedCode ? (
                <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap">
                  {generatedCode}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-white/30 text-sm">
                  Generated code will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
