"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

interface AgentPrompt {
  iconUrl: string
  appName: string
  text: string
}

const PROMPTS: AgentPrompt[] = [
  {
    iconUrl: "https://svgl.app/library/gmail.svg",
    appName: "Gmail",
    text: "please send an email to jason for a meeting",
  },
  {
    iconUrl: "https://svgl.app/library/minecraft.svg",
    appName: "Minecraft",
    text: "set up a new Minecraft server with plugins and whitelist",
  },
  {
    iconUrl: "https://svgl.app/library/linear.svg",
    appName: "Linear",
    text: "create a Linear ticket for the API timeout bug with repro steps",
  },
  {
    iconUrl: "https://svgl.app/library/microsoftexcel.svg",
    appName: "Excel",
    text: "build a quarterly sales report with pivot tables and charts",
  },
  {
    iconUrl: "https://svgl.app/library/notion.svg",
    appName: "Notion",
    text: "draft the Q3 planning doc and share with the engineering team",
  },
  {
    iconUrl: "https://svgl.app/library/slack.svg",
    appName: "Slack",
    text: "send a summary of today's standup to the #engineering channel",
  },
  {
    iconUrl: "https://svgl.app/library/figma.svg",
    appName: "Figma",
    text: "convert this design mockup into a responsive landing page",
  },
  {
    iconUrl: "https://svgl.app/library/github.svg",
    appName: "GitHub",
    text: "review the open PRs and merge the ones that passed CI",
  },
  {
    iconUrl: "https://svgl.app/library/stripe.svg",
    appName: "Stripe",
    text: "generate an invoice for client Acme Corp and send via email",
  },
  {
    iconUrl: "https://svgl.app/library/googledrive.svg",
    appName: "Google Drive",
    text: "organize the shared drive and archive last year's documents",
  },
]

export function AgentPromptCycler() {
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % PROMPTS.length)
        setFade(true)
      }, 300)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const prompt = PROMPTS[index]

  return (
    <div className="flex items-center gap-3 transition-opacity duration-300" style={{ opacity: fade ? 1 : 0 }}>
      <Image
        src={prompt.iconUrl}
        alt={prompt.appName}
        width={24}
        height={24}
        className="h-6 w-6 shrink-0"
        unoptimized
      />
      <span className="text-sm text-[#A7AAB0]">{prompt.text}</span>
    </div>
  )
}
