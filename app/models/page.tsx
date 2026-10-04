import { Metadata } from "next"
import { ModelBrowserView } from "@/components/sycord-omni-router-modal"

export const metadata: Metadata = {
  title: "Model Browser | Sycord",
  description: "Browse, explore, and configure AI models for Sycord.",
}

export default function ModelsPage() {
  return (
    <div className="w-full min-h-screen bg-[#131313]">
      <ModelBrowserView isStandalone={true} />
    </div>
  )
}
