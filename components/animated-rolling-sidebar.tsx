"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  Lock,
  Coins,
  Pin,
} from "lucide-react"

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  requiresDatabase?: boolean
}

interface NavGroup {
  key: string
  title: string
  defaultOpen?: boolean
  items: NavItem[]
  pinned?: boolean
}

interface AnimatedRollingSidebarProps {
  isOpen: boolean
  onClose: () => void
  project?: { businessName?: string }
  activeTab: string
  setActiveTab: (tab: string) => void
  navGroups: NavGroup[]
  getWebsiteIcon: () => React.ComponentType<{ className?: string }>
  databaseConnected: boolean
  session?: { user?: { name?: string; image?: string; email?: string } }
  subscription?: string
  planCredit?: number
  userInitials: string
  onManageAccess?: () => void
}

// Shared sidebar navigation content
const SidebarNavContent = ({
  navGroups,
  activeTab,
  setActiveTab,
  onClose,
  databaseConnected,
}: {
  navGroups: NavGroup[]
  activeTab: string
  setActiveTab: (tab: string) => void
  onClose: () => void
  databaseConnected: boolean
}) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const g of navGroups) {
      if (g.defaultOpen) initial.add(g.key)
    }
    return initial
  })

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    for (const g of navGroups) {
      if (g.items.some((i) => i.id === activeTab)) {
        setOpenGroups((prev) => {
          if (prev.has(g.key)) return prev
          const next = new Set(prev)
          next.add(g.key)
          return next
        })
        break
      }
    }
  }, [activeTab, navGroups])

  return (
    <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
      <div className="px-3 pb-2 pt-1">
        <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">
          Platform
        </span>
      </div>

      {navGroups.map((group) => {
        const isOpen = openGroups.has(group.key)
        const groupHasActive = group.items.some((i) => i.id === activeTab)
        const isPinned = group.pinned

        return (
          <div key={group.key} className="mb-0.5">
            <button
              onClick={() => toggleGroup(group.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isOpen && groupHasActive
                  ? "bg-white/[0.07]"
                  : "hover:bg-white/[0.04]"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold border",
                groupHasActive
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/[0.04] border-white/[0.08] text-white/50"
              )}>
                {group.title.charAt(0)}
              </div>

              <span className={cn(
                "flex-1 text-left text-sm font-semibold",
                groupHasActive ? "text-white" : "text-white/60"
              )}>
                {group.title}
              </span>

              {isPinned && (
                <Pin className="h-3 w-3 text-white/25 shrink-0" />
              )}

              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-white/30 transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-0.5 ml-4 pl-3.5 border-l border-white/[0.07] space-y-0.5 pb-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeTab === item.id
                      const isLocked = item.requiresDatabase && !databaseConnected

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (isLocked) return
                            setActiveTab(item.id)
                            onClose()
                          }}
                          disabled={isLocked}
                          title={isLocked ? "Connect a database to unlock" : undefined}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-left relative",
                            isActive
                              ? "text-white font-semibold"
                              : isLocked
                              ? "text-white/20 cursor-not-allowed"
                              : "text-white/50 font-medium hover:text-white/80 hover:bg-white/[0.04]"
                          )}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-white rounded-full"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                            />
                          )}
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate flex-1">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.07] text-white/50 shrink-0">
                              {item.badge}
                            </span>
                          )}
                          {isLocked && <Lock className="h-3 w-3 shrink-0 opacity-40" />}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </nav>
  )
}

// Shared bottom section
const SidebarBottom = ({
  userInitials,
  session,
  subscription,
  planCredit,
  onManageAccess,
  onClose,
}: {
  userInitials: string
  session?: { user?: { name?: string } }
  subscription?: string
  planCredit?: number
  onManageAccess?: () => void
  onClose: () => void
}) => (
  <div className="mt-auto border-t border-white/[0.06] p-3 space-y-2">
    {onManageAccess && (
      <button
        onClick={() => { onClose(); onManageAccess() }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] transition-colors"
      >
        <span className="h-7 w-7 rounded-full bg-purple-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {userInitials.charAt(0)}
        </span>
        <span className="text-sm font-medium text-white/80">Manage access</span>
      </button>
    )}

    <div className="flex items-center gap-3 px-3 py-2">
      <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
        {userInitials}
      </div>
      <span className="flex-1 text-xs font-medium truncate text-white/70">
        {session?.user?.name || "User"}
      </span>
    </div>

    <div className="px-3 space-y-1.5">
      <span className="text-[10px] text-white/35 flex items-center gap-1.5">
        <Coins className="h-3 w-3" />
        Monthly Credit
      </span>
      <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-white/25"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
        />
      </div>
    </div>
  </div>
)

// ── Mobile sidebar panel ────────────────────────────────────────────────────
// Positioned absolutely behind the main content. The main content slides right
// to reveal this sidebar, creating the "merge into menubar" effect.
export function AnimatedRollingSidebar({
  isOpen,
  onClose,
  project,
  activeTab,
  setActiveTab,
  navGroups,
  getWebsiteIcon,
  databaseConnected,
  session,
  subscription = "Sycord",
  planCredit = 2,
  userInitials,
  onManageAccess,
}: AnimatedRollingSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex flex-col"
          style={{
            backgroundColor: "#121212",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
            <Image src="/logo.png" alt="Sycord Logo" width={32} height={32} className="opacity-90 flex-shrink-0" />
            <span className="text-white font-semibold text-[15px] tracking-tight">Sycord</span>
          </div>

          <SidebarNavContent
            navGroups={navGroups}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onClose={onClose}
            databaseConnected={databaseConnected}
          />

          <SidebarBottom
            userInitials={userInitials}
            session={session}
            subscription={subscription}
            planCredit={planCredit}
            onManageAccess={onManageAccess}
            onClose={onClose}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Desktop permanent sidebar ───────────────────────────────────────────────
export function AnimatedRollingSidebarDesktop({
  isExpanded,
  onExpandChange,
  project,
  activeTab,
  setActiveTab,
  navGroups,
  getWebsiteIcon,
  databaseConnected,
  session,
  subscription = "Sycord",
  planCredit = 2,
  userInitials,
  onManageAccess,
}: AnimatedRollingSidebarProps & { isExpanded: boolean; onExpandChange: (expanded: boolean) => void }) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 272 : 68 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={() => onExpandChange(false)}
      className="relative flex flex-col h-full overflow-hidden"
      style={{
        backgroundColor: "rgba(20, 20, 22, 0.97)",
        backdropFilter: "blur(32px) saturate(1.6)",
        WebkitBackdropFilter: "blur(32px) saturate(1.6)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5 overflow-hidden">
        <Image src="/logo.png" alt="Sycord Logo" width={32} height={32} className="opacity-90 flex-shrink-0" priority />
        <motion.span
          initial={false}
          animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -8 }}
          transition={{ duration: 0.18 }}
          className="text-white font-semibold text-[15px] tracking-tight whitespace-nowrap"
        >
          Sycord
        </motion.span>
      </div>

      {/* Nav — icons only when collapsed */}
      <div className="flex-1 overflow-hidden">
        {isExpanded ? (
          <SidebarNavContent
            navGroups={navGroups}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onClose={() => {}}
            databaseConnected={databaseConnected}
          />
        ) : (
          <nav className="px-2.5 py-2 space-y-1">
            {navGroups.flatMap((group) =>
              group.items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                const isLocked = item.requiresDatabase && !databaseConnected
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (!isLocked) setActiveTab(item.id) }}
                    disabled={isLocked}
                    className={cn(
                      "w-full flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 relative",
                      isActive
                        ? "bg-white/10 text-white"
                        : isLocked
                        ? "text-white/20 cursor-not-allowed"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {isActive && (
                      <motion.div
                        layoutId="desktopActiveBar"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-full"
                      />
                    )}
                  </button>
                )
              })
            )}
          </nav>
        )}
      </div>

      {/* Bottom */}
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded-bottom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <SidebarBottom
              userInitials={userInitials}
              session={session}
              subscription={subscription}
              planCredit={planCredit}
              onManageAccess={onManageAccess}
              onClose={() => {}}
            />
          </motion.div>
        ) : (
          <motion.div
            key="collapsed-bottom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-3 flex justify-center border-t border-white/[0.06]"
          >
            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
              {userInitials}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}

export default AnimatedRollingSidebar
