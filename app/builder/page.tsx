import AstroChat from "@/components/astro-chat"

export const metadata = {
  title: "Astro — AI Architect & Builder",
  description: "Autonomous AI site builder and live dev server.",
}

export default function BuilderPage() {
  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden">
      <AstroChat />
    </main>
  )
}
