import { Metadata } from "next"
import { ModelBrowserView } from "@/components/sycord-omni-router-modal"

export const metadata: Metadata = {
  title: "Select Model | Sycord",
  description: "Select and configure AI models for Sycord.",
}

export default function ModelsPage() {
  return (
    <div className="w-full min-h-screen bg-[#111111] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="w-full max-w-lg">
        <ModelBrowserView isStandalone={true} />
      </div>
    </div>
  )
}
