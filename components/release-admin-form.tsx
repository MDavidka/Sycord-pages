"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ImagePlus, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

const initialForm = { title: "", version: "", summary: "", imageUrl: "" }

export default function ReleaseAdminForm() {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  function update(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setStatus("idle")
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("saving")
    try {
      const response = await fetch("/api/releases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!response.ok) throw new Error("Could not publish update")
      setForm(initialForm)
      setStatus("saved")
      router.refresh()
    } catch {
      setStatus("error")
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-[28px] border border-white/[0.08] bg-[#1c1d21] p-6 sm:p-8 lg:grid-cols-2">
      <label className="text-sm font-medium text-white/70">Title<input required value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="A quiet beginning" className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#151619] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30" /></label>
      <label className="text-sm font-medium text-white/70">Version<input required value={form.version} onChange={(event) => update("version", event.target.value)} placeholder="0.2" className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#151619] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30" /></label>
      <label className="text-sm font-medium text-white/70 lg:col-span-2">Photo URL<div className="relative mt-2"><ImagePlus className="pointer-events-none absolute left-3 top-3 size-4 text-white/25" /><input required type="url" value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="https://… or /your-image.jpg" className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#151619] pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30" /></div></label>
      <label className="text-sm font-medium text-white/70 lg:col-span-2">Version note<textarea required value={form.summary} onChange={(event) => update("summary", event.target.value)} placeholder="What changed in this release?" rows={4} className="mt-2 w-full resize-none rounded-xl border border-white/[0.1] bg-[#151619] px-3 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30" /></label>
      <div className="flex flex-wrap items-center gap-4 lg:col-span-2"><Button type="submit" disabled={status === "saving"} className="rounded-xl bg-white text-black hover:bg-white/90">{status === "saving" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Publish update</Button>{status === "saved" && <span className="flex items-center gap-1.5 text-sm text-emerald-300"><Check className="size-4" /> Published</span>}{status === "error" && <span className="text-sm text-red-300">Could not publish. Check your admin access and try again.</span>}</div>
    </form>
  )
}
