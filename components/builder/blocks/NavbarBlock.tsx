import type { BlockConfig } from "@/lib/builder/types"
import { Menu } from "lucide-react"

interface NavbarProps {
  logo: string
  links: string[]
  ctaText: string
}

function NavbarDefault({ props }: { props: NavbarProps }) {
  const { logo, links = [], ctaText } = props

  return (
    <nav className="px-6 @md:px-10 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green/10 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-green" />
        </div>
        <span className="font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
      </div>

      <div className="hidden @2xl:flex items-center gap-6">
        {links.map((link, i) => (
          <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer">
            {link}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button className="px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors">
          {ctaText}
        </button>
        <button className="@2xl:hidden w-9 h-9 rounded-lg border border-border-default flex items-center justify-center text-text-2 hover:text-text-0 hover:bg-bg-3 transition-colors">
          <Menu size={16} />
        </button>
      </div>
    </nav>
  )
}

function NavbarCentered({ props }: { props: NavbarProps }) {
  const { logo, links = [], ctaText } = props
  const mid = Math.ceil(links.length / 2)
  const leftLinks = links.slice(0, mid)
  const rightLinks = links.slice(mid)

  return (
    <nav className="px-6 @md:px-10 py-4 flex items-center justify-between">
      <div className="hidden @2xl:flex items-center gap-6 flex-1">
        {leftLinks.map((link, i) => (
          <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer">
            {link}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green/10 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-green" />
        </div>
        <span className="font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
      </div>

      <div className="hidden @2xl:flex items-center gap-6 flex-1 justify-end">
        {rightLinks.map((link, i) => (
          <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer">
            {link}
          </span>
        ))}
        <button className="px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors ml-2">
          {ctaText}
        </button>
      </div>

      <button className="@2xl:hidden w-9 h-9 rounded-lg border border-border-default flex items-center justify-center text-text-2 hover:text-text-0 hover:bg-bg-3 transition-colors">
        <Menu size={16} />
      </button>
    </nav>
  )
}

export function NavbarBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as NavbarProps
  switch (block.variant) {
    case "centered":
      return <NavbarCentered props={props} />
    default:
      return <NavbarDefault props={props} />
  }
}
