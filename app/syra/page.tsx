import SyraChatPage from "@/components/syra-chat-page"

export const metadata = {
  title: "Syra — AI Chat",
  description: "Syra AI coding assistant",
}

export default function SyraPage() {
  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#121214]">
      <SyraChatPage />
    </main>
  )
}
