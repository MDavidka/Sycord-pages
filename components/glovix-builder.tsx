"use client"

import AstroChat from "@/components/astro-chat"

interface GlovixBuilderProps {
  projectId?: string
  projectName?: string | null
  userImage?: string | null
  onBack?: () => void
  preset?: string
}

/**
 * Compatibility bridge: replaces legacy Glovix WebContainer builder with AstroChat.
 */
export default function GlovixBuilder({
  projectId,
  projectName,
  userImage,
  onBack,
}: GlovixBuilderProps) {
  return (
    <div className="h-full w-full">
      <AstroChat
        projectId={projectId}
        projectName={projectName}
        userImage={userImage}
        onBack={onBack}
      />
    </div>
  )
}
