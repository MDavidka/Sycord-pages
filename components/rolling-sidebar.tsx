"use client"

import { useState, useEffect } from "react"
import {
  Home,
  Server,
  Settings,
  Globe,
  Database,
  Cpu,
  ChevronDown,
  ChevronRight,
  Pin,
  LayoutGrid,
  Gamepad2,
  Activity,
  Users,
  CreditCard,
} from "lucide-react"

interface NavSubItem {
  label: string
  active?: boolean
}

interface NavItem {
  label: string
  icon: React.ReactNode
  subItems?: NavSubItem[]
  expanded?: boolean
  pinned?: boolean
}

export function RollingSidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Compute: true,
    "Game hosting": true,
  })

  const navItems: NavItem[] = [
    { label: "Home", icon: <Home size={18} /> },
    {
      label: "Compute",
      icon: <Cpu size={18} />,
      expanded: expandedSections["Compute"],
      subItems: [
        { label: "Virtual servers", active: true },
        { label: "Settings" },
      ],
    },
    {
      label: "Game hosting",
      icon: <Gamepad2 size={18} />,
      expanded: expandedSections["Game hosting"],
      pinned: true,
      subItems: [
        { label: "Servers" },
        { label: "Domains" },
        { label: "Resources" },
        { label: "Earn credits" },
      ],
    },
    { label: "Network", icon: <Globe size={18} /> },
    { label: "Databases", icon: <Database size={18} /> },
    { label: "Monitoring", icon: <Activity size={18} /> },
  ]

  const toggleExpand = () => {
    setIsExpanded((v) => !v)
    setHasAnimated(true)
  }

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  // Auto-demo on mount
  useEffect(() => {
    const t = setTimeout(() => {
      setIsExpanded(true)
      setHasAnimated(true)
    }, 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ background: "#121212" }}
    >
      {/* ── Black right-side segment ── */}
      <div
        className="absolute top-0 right-0 h-full"
        style={{
          width: "42%",
          background: "#000000",
          borderTopLeftRadius: "28px",
          borderBottomLeftRadius: "28px",
          zIndex: 1,
        }}
      />

      {/* ── Logo-only layer (always visible behind panel) ── */}
      <div
        className="absolute top-0 left-0 h-full flex flex-col"
        style={{ width: "58%", zIndex: 2 }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-6 pt-10 pb-8">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 38,
              height: 38,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {/* S lettermark */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M14 5.5C14 4.119 12.881 3 11.5 3h-3C7.119 3 6 4.119 6 5.5S7.119 8 8.5 8h3C12.881 8 14 9.119 14 10.5S12.881 13 11.5 13h-3C7.119 13 6 11.881 6 10.5"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            className="font-semibold tracking-tight"
            style={{ color: "rgba(255,255,255,0.9)", fontSize: 17 }}
          >
            sycord
          </span>
        </div>
      </div>

      {/* ── Rolling Navigation Panel ── */}
      <div
        className="absolute top-0 left-0 h-full flex flex-col"
        style={{
          width: "72%",
          background: "rgba(22,22,24,0.92)",
          backdropFilter: "blur(28px) saturate(1.5)",
          WebkitBackdropFilter: "blur(28px) saturate(1.5)",
          borderTopRightRadius: isExpanded ? "36px" : "0px",
          borderBottomRightRadius: isExpanded ? "36px" : "0px",
          border: "1px solid rgba(255,255,255,0.07)",
          borderLeft: "none",
          boxShadow: isExpanded
            ? "8px 0 48px rgba(0,0,0,0.7), inset -1px 0 0 rgba(255,255,255,0.06)"
            : "none",
          zIndex: 10,
          transform: isExpanded ? "translateX(0)" : "translateX(-101%)",
          transition: "transform 0.65s cubic-bezier(0.34, 1.10, 0.64, 1), border-radius 0.5s ease, box-shadow 0.5s ease",
          willChange: "transform",
        }}
      >
        {/* Panel header: logo */}
        <div className="flex items-center justify-between px-6 pt-10 pb-6">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 38,
                height: 38,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M14 5.5C14 4.119 12.881 3 11.5 3h-3C7.119 3 6 4.119 6 5.5S7.119 8 8.5 8h3C12.881 8 14 9.119 14 10.5S12.881 13 11.5 13h-3C7.119 13 6 11.881 6 10.5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span
              className="font-semibold tracking-tight"
              style={{ color: "rgba(255,255,255,0.9)", fontSize: 17 }}
            >
              sycord
            </span>
          </div>
        </div>

        {/* Section label */}
        <div
          className="px-6 pb-3"
          style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          Platform
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {navItems.map((item, idx) => (
            <div
              key={item.label}
              className="mb-0.5 sidebar-nav-item"
              style={{
                animationDelay: isExpanded ? `${0.18 + idx * 0.055}s` : "0s",
                opacity: isExpanded ? undefined : 0,
              }}
            >
              {/* Parent row */}
              <button
                className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200 group"
                style={{
                  background:
                    item.expanded
                      ? "rgba(255,255,255,0.07)"
                      : "transparent",
                  color: item.expanded ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                }}
                onClick={() => item.subItems && toggleSection(item.label)}
              >
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    color: item.expanded ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="flex-1 text-left font-medium"
                  style={{ fontSize: 14 }}
                >
                  {item.label}
                </span>
                {item.pinned && (
                  <Pin size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
                )}
                {item.subItems && (
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>
                    {expandedSections[item.label] ? (
                      <ChevronDown size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </span>
                )}
              </button>

              {/* Sub items */}
              {item.subItems && expandedSections[item.label] && (
                <div className="ml-4 mb-1">
                  {item.subItems.map((sub) => (
                    <button
                      key={sub.label}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
                      style={{
                        background: sub.active ? "rgba(255,255,255,0.05)" : "transparent",
                        color: sub.active
                          ? "rgba(255,255,255,0.95)"
                          : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {/* Active accent line */}
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 2,
                          height: 16,
                          background: sub.active
                            ? "rgba(255,255,255,0.7)"
                            : "rgba(255,255,255,0.12)",
                          boxShadow: sub.active
                            ? "0 0 8px rgba(255,255,255,0.4)"
                            : "none",
                          transition: "all 0.2s",
                        }}
                      />
                      <span style={{ fontSize: 13.5, fontWeight: sub.active ? 600 : 400 }}>
                        {sub.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom user row */}
        <div
          className="flex items-center gap-3 px-5 py-5 mt-auto"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{
              width: 32,
              height: 32,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <Users size={15} style={{ color: "rgba(255,255,255,0.6)" }} />
          </div>
          <div className="flex flex-col leading-tight">
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>
              My Account
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              Pro plan
            </span>
          </div>
          <CreditCard size={15} style={{ color: "rgba(255,255,255,0.25)", marginLeft: "auto" }} />
        </div>
      </div>

      {/* ── Curved shadow bridge — the "landing" depth effect ── */}
      <div
        className="absolute top-0 right-0 h-full pointer-events-none"
        style={{
          width: "48%",
          zIndex: 9,
          background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0) 100%)",
          opacity: isExpanded ? 1 : 0,
          transition: "opacity 0.5s ease 0.3s",
        }}
      />

      {/* ── Toggle button ── */}
      <button
        onClick={toggleExpand}
        className="absolute z-20 flex items-center justify-center rounded-2xl transition-all duration-300 active:scale-95"
        style={{
          bottom: 32,
          right: 24,
          width: 52,
          height: 52,
          background: isExpanded
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          color: "rgba(255,255,255,0.65)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <LayoutGrid size={20} />
      </button>

      {/* ── State label ── */}
      <div
        className="absolute z-20 flex flex-col items-end"
        style={{ top: 24, right: 20 }}
      >
        <span
          className="rounded-full px-3 py-1 text-xs font-medium tracking-wide"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.35)",
            fontSize: 10,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {isExpanded ? "Nav open" : "Logo only"}
        </span>
      </div>
    </div>
  )
}
