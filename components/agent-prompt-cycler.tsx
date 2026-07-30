"use client"

import { useState, useEffect } from "react"

interface AgentPrompt {
  iconUrl: string
  appName: string
  text: string
}

const PROMPTS: AgentPrompt[] = [
  {
    iconUrl: "https://svgl.app/library/linear.svg",
    appName: "Linear",
    text: "create a Linear ticket for the API timeout bug with repro steps",
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
    iconUrl: "https://svgl.app/library/github_dark.svg",
    appName: "GitHub",
    text: "review the open PRs and merge the ones that passed CI",
  },
  {
    iconUrl: "https://svgl.app/library/stripe.svg",
    appName: "Stripe",
    text: "generate an invoice for client Acme Corp and send via email",
  },
  {
    iconUrl: "https://svgl.app/library/notion.svg",
    appName: "Notion",
    text: "draft the Q3 planning doc and share with the engineering team",
  },
  {
    iconUrl: "https://svgl.app/library/vercel_dark.svg",
    appName: "Vercel",
    text: "deploy the new staging environment for review",
  },
  {
    iconUrl: "https://svgl.app/library/supabase.svg",
    appName: "Supabase",
    text: "set up a new database with Row Level Security policies",
  },
  {
    iconUrl: "https://svgl.app/library/docker.svg",
    appName: "Docker",
    text: "containerize the microservice and push to the registry",
  },
  {
    iconUrl: "https://svgl.app/library/prisma_dark.svg",
    appName: "Prisma",
    text: "generate a migration for the new users and teams schema",
  },
]

export function AgentPromptCycler() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [iconError, setIconError] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setIconError(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % PROMPTS.length)
        setVisible(true)
      }, 300)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const prompt = PROMPTS[index]

  return (
    <div
      className="flex items-center gap-3 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {iconError ? (
        <div
          className="h-5 w-5 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/70 font-semibold"
          aria-hidden="true"
        >
          {prompt.appName[0]}
        </div>
      ) : (
        <img
          src={prompt.iconUrl}
          alt=""
          className="h-5 w-5 shrink-0 opacity-80"
          onError={() => setIconError(true)}
        />
      )}
      <span className="text-base font-medium text-white/90">{prompt.text}</span>
    </div>
  )
}
