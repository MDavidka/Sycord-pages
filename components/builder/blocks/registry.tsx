"use client"

import type { BlockConfig } from "@/lib/builder/types"
import { Component, type ReactNode } from "react"

import { NavbarBlock } from "./NavbarBlock"
import { HeroBlock } from "./HeroBlock"
import { FeaturesBlock } from "./FeaturesBlock"
import { PricingBlock } from "./PricingBlock"
import { CtaBlock } from "./CtaBlock"
import { FooterBlock } from "./FooterBlock"
import { TestimonialsBlock } from "./TestimonialsBlock"
import { StatsBlock } from "./StatsBlock"
import { FaqBlock } from "./FaqBlock"
import { TeamBlock } from "./TeamBlock"
import { ContactBlock } from "./ContactBlock"
import { NewsletterBlock } from "./NewsletterBlock"
import { LogoCloudBlock } from "./LogoCloudBlock"
import { DividerBlock } from "./DividerBlock"
import { BannerBlock } from "./BannerBlock"
import { ContentBlock } from "./ContentBlock"
import { ImageBlock } from "./ImageBlock"
import { VideoBlock } from "./VideoBlock"
import { GalleryBlock } from "./GalleryBlock"

class BlockErrorBoundary extends Component<
  { blockType: string; children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-8 text-center border border-status-red/20 bg-status-red/5 rounded-lg mx-4 my-2">
          <p className="text-status-red text-sm font-medium mb-1">Failed to render {this.props.blockType} block</p>
          <p className="text-text-3 text-xs">{this.state.error?.message || "An unexpected error occurred"}</p>
        </div>
      )
    }
    return this.props.children
  }
}

function PlaceholderBlock({ block }: { block: BlockConfig }) {
  return <div className="px-9 py-7 text-center text-text-3 text-sm">{block.type} block (coming soon)</div>
}

const blockRenderers: Record<string, React.ComponentType<{ block: BlockConfig }>> = {
  navbar: NavbarBlock,
  hero: HeroBlock,
  features: FeaturesBlock,
  pricing: PricingBlock,
  cta: CtaBlock,
  footer: FooterBlock,
  testimonials: TestimonialsBlock,
  stats: StatsBlock,
  faq: FaqBlock,
  team: TeamBlock,
  contact: ContactBlock,
  newsletter: NewsletterBlock,
  logocloud: LogoCloudBlock,
  divider: DividerBlock,
  banner: BannerBlock,
  content: ContentBlock,
  image: ImageBlock,
  video: VideoBlock,
  gallery: GalleryBlock,
}

export function RenderBlock({ block }: { block: BlockConfig }): ReactNode {
  const Renderer = blockRenderers[block.type] || PlaceholderBlock
  return (
    <BlockErrorBoundary blockType={block.type}>
      <Renderer block={block} />
    </BlockErrorBoundary>
  )
}
