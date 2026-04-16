"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  ChevronRight,
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
  session?: { user?: { name?: string; image?: string } }
  subscription?: string
  planCredit?: number
  userInitials: string
  onManageAccess?: () => void
}

// Sidebar navigation content
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
  // Initialize open groups from defaultOpen
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

  // Auto-open group containing active tab
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
    <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar px-3 py-4">
      {/* Platform label */}
      <div className="px-3 pb-2">
        <span className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">
          Platform
        </span>
      </div>

      {navGroups.map((group) => {
        const isOpen = openGroups.has(group.key)
        const groupHasActive = group.items.some((i) => i.id === activeTab)
        const isPinned = group.pinned

        return (
          <div key={group.key} className="mb-1">
            {/* Folder header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isOpen && groupHasActive
                  ? "bg-[#2a2a2c]"
                  : "hover:bg-white/[0.04]"
              )}
            >
              {/* Group icon placeholder */}
              <div className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center border border-white/10",
                groupHasActive ? "bg-white/10" : "bg-transparent"
              )}>
                <span className="text-[10px] text-white/60">
                  {group.title.charAt(0)}
                </span>
              </div>
              
              <span className={cn(
                "flex-1 text-left text-sm font-medium",
                groupHasActive ? "text-white" : "text-white/70"
              )}>
                {group.title}
              </span>

              {/* Pin icon for pinned groups */}
              {isPinned && (
                <Pin className="h-3.5 w-3.5 text-white/30 shrink-0" />
              )}

              {/* Chevron */}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-white/40 transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )}
              />
            </button>

            {/* Folder items with animated expand */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-3 pl-4 border-l border-white/[0.06] space-y-0.5">
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
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium text-left relative",
                            isActive
                              ? "text-white"
                              : isLocked
                              ? "text-white/20 cursor-not-allowed"
                              : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                          )}
                        >
                          {/* Active indicator line */}
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-full"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                            />
                          )}

                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate flex-1 text-left">{item.label}</span>
                          
                          {item.badge && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/60 shrink-0">
                              {item.badge}
                            </span>
                          )}
                          {isLocked && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
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
  const WebsiteIcon = getWebsiteIcon()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background layer - deep dark gray canvas */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "#121212" }}
            onClick={onClose}
          >
            {/* The "Shadow" Segment - fixed pitch-black bar on far right */}
            <div
              className="absolute right-0 top-0 bottom-0 w-[35%]"
              style={{
                backgroundColor: "#000000",
                borderTopLeftRadius: "32px",
                borderBottomLeftRadius: "32px",
              }}
            />
          </motion.div>

          {/* Navigation Panel - the "rolling" layer with curved edge */}
          <motion.aside
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
            className="fixed inset-y-0 left-0 z-50 w-[72%] max-w-[320px] flex flex-col"
            style={{
              backgroundColor: "rgba(28, 28, 30, 0.92)",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              borderTopRightRadius: "40px",
              borderBottomRightRadius: "40px",
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.06),
                20px 0 60px -10px rgba(0,0,0,0.6),
                40px 0 100px -20px rgba(0,0,0,0.4)
              `,
            }}
          >
            {/* Logo header */}
            <div className="flex items-center gap-3 px-5 pt-6 pb-4">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <WebsiteIcon className="h-5 w-5 text-white/80" />
              </div>
              <span className="font-semibold text-white text-lg tracking-tight">
                {project?.businessName || "sycord"}
              </span>
            </div>

            {/* Navigation content */}
            <SidebarNavContent
              navGroups={navGroups}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onClose={onClose}
              databaseConnected={databaseConnected}
            />

            {/* Bottom section - Manage access & Account */}
            <div className="mt-auto border-t border-white/[0.06] p-4 space-y-3">
              {/* Manage Access button */}
              {onManageAccess && (
                <button
                  onClick={() => {
                    onClose()
                    onManageAccess()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  <span className="h-7 w-7 rounded-full bg-purple-500/80 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                    {userInitials.charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-white/80">Manage access</span>
                </button>
              )}

              {/* Account row */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03]">
                <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {userInitials}
                </div>
                <span className="flex-1 text-xs font-medium truncate text-white/70">
                  {session?.user?.name || "User"}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-white/60">
                  {subscription}
                </span>
              </div>

              {/* Credit bar */}
              <div className="px-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40 flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    Monthly Credit
                  </span>
                  <span className="text-[11px] font-semibold text-white/70">{planCredit}€</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <motion.div 
                    className="h-full rounded-full bg-white/30"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Curved edge overlay for depth effect */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="fixed z-45 pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              left: "72%",
              maxWidth: "320px",
              width: "60px",
              marginLeft: "-30px",
              background: `linear-gradient(to right, 
                rgba(28, 28, 30, 0.5) 0%, 
                rgba(18, 18, 18, 0.3) 50%,
                transparent 100%
              )`,
              borderTopRightRadius: "40px",
              borderBottomRightRadius: "40px",
            }}
          />
        </>
      )}
    </AnimatePresence>
  )
}

// Desktop version with permanent visibility and hover expand
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
  const WebsiteIcon = getWebsiteIcon()

  return (
    <div className="relative h-full flex">
      {/* Background layer - deep dark gray */}
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: "#121212" }}
      />

      {/* The navigation panel with curved edge */}
      <motion.aside
        initial={false}
        animate={{ width: isExpanded ? 280 : 72 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        onMouseEnter={() => onExpandChange(true)}
        onMouseLeave={() => onExpandChange(false)}
        className="relative z-10 flex flex-col h-full"
        style={{
          backgroundColor: "rgba(28, 28, 30, 0.95)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          borderTopRightRadius: isExpanded ? "32px" : "0",
          borderBottomRightRadius: isExpanded ? "32px" : "0",
          boxShadow: isExpanded
            ? `
              0 0 0 1px rgba(255,255,255,0.06),
              12px 0 40px -8px rgba(0,0,0,0.5)
            `
            : "none",
        }}
      >
        {/* Logo header */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-4 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
            <WebsiteIcon className="h-5 w-5 text-white/80" />
          </div>
          <motion.span
            initial={false}
            animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -10 }}
            transition={{ duration: 0.2 }}
            className="font-semibold text-white text-lg tracking-tight whitespace-nowrap"
          >
            {project?.businessName || "sycord"}
          </motion.span>
        </div>

        {/* Navigation - collapsed shows only icons */}
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
            <nav className="px-3 py-4 space-y-2">
              {navGroups.flatMap((group) =>
                group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  const isLocked = item.requiresDatabase && !databaseConnected

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (!isLocked) setActiveTab(item.id)
                      }}
                      disabled={isLocked}
                      className={cn(
                        "w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 relative",
                        isActive
                          ? "bg-white/10 text-white"
                          : isLocked
                          ? "text-white/20 cursor-not-allowed"
                          : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {isActive && (
                        <motion.div
                          layoutId="desktopActiveIndicator"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-white rounded-full"
                        />
                      )}
                    </button>
                  )
                })
              )}
            </nav>
          )}
        </div>

        {/* Bottom section - collapsed shows only avatar */}
        <div className="mt-auto border-t border-white/[0.06] p-3">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {onManageAccess && (
                  <button
                    onClick={onManageAccess}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="h-7 w-7 rounded-full bg-purple-500/80 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {userInitials.charAt(0)}
                    </span>
                    <span className="text-sm font-medium text-white/80">Manage access</span>
                  </button>
                )}

                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03]">
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {userInitials}
                  </div>
                  <span className="flex-1 text-xs font-medium truncate text-white/70">
                    {session?.user?.name || "User"}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-white/60">
                    {subscription}
                  </span>
                </div>

                <div className="px-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      Monthly Credit
                    </span>
                    <span className="text-[11px] font-semibold text-white/70">{planCredit}€</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full w-full rounded-full bg-white/30" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center"
              >
                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                  {userInitials}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* The "Shadow" Segment - pitch-black area on the right */}
      <div
        className="flex-1 relative"
        style={{ backgroundColor: "#000000" }}
      >
        {/* Curved overlap effect from the sidebar */}
        <motion.div
          initial={false}
          animate={{ 
            opacity: isExpanded ? 1 : 0,
            x: isExpanded ? 0 : -20 
          }}
          className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none"
          style={{
            background: `linear-gradient(to right, 
              rgba(28, 28, 30, 0.4) 0%, 
              transparent 100%
            )`,
            borderTopLeftRadius: "32px",
            borderBottomLeftRadius: "32px",
          }}
        />
      </div>
    </div>
  )
}

export default AnimatedRollingSidebar
