import { BuilderProvider } from "@/components/builder/builder-state"
import { BuilderShell } from "@/components/builder/builder-shell"

export default function BuilderPage() {
  return (
    <BuilderProvider>
      <BuilderShell />
    </BuilderProvider>
  )
}
