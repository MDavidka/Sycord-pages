import GlovixBuilder from "@/components/glovix-builder"

// Standalone full-screen Glovix AI builder. WebContainers require the document
// to be cross-origin isolated; the COOP/COEP headers for this route are set in
// next.config.mjs.
export const metadata = {
  title: "Glovix — AI Builder",
  description: "Build, run, and debug web applications directly in your browser.",
}

export default function BuilderPage() {
  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden">
      <GlovixBuilder />
    </main>
  )
}
