'use client'

import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type IconProps = {
  className?: string
  title?: string
}

function SvgShell({
  className,
  title,
  children,
  viewBox = '0 0 24 24',
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      className={cn('h-4 w-4 shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function GitHubMcpIcon({ className, title = 'GitHub' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        fill="currentColor"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
      />
    </SvgShell>
  )
}

export function LinearMcpIcon({ className, title = 'Linear' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        fill="#5E6AD2"
        d="M2.86 18.86 18.86 2.86A8.48 8.48 0 0 0 12 1.5 10.5 10.5 0 0 0 1.5 12c0 2.5.88 4.8 2.36 6.6l-.001.26Zm2.28 2.28A10.45 10.45 0 0 0 12 22.5 10.5 10.5 0 0 0 22.5 12c0-2.5-.88-4.8-2.36-6.6L5.14 21.14Z"
      />
    </SvgShell>
  )
}

/** @deprecated alias */
export function LinearMcpIconSimple(props: IconProps) {
  return <LinearMcpIcon {...props} />
}

export function SupabaseMcpIcon({ className, title = 'Supabase' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        fill="#3ECF8E"
        d="M13.9 2.14a.8.8 0 0 0-1.37-.3L2.3 14.1a.8.8 0 0 0 .63 1.29h7.3v6.47a.8.8 0 0 0 1.37.3l10.23-12.26a.8.8 0 0 0-.63-1.29h-7.3V2.14Z"
      />
    </SvgShell>
  )
}

export function DatadogMcpIcon({ className, title = 'Datadog' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        fill="#632CA6"
        d="M12.1 2.1c-4.4 0-8.1 2.9-9.4 6.9-.2.7.3 1.4 1 1.4h.2c.5 0 .9-.3 1.1-.7 1-2.9 3.7-5 6.9-5 4 0 7.2 3.2 7.2 7.2s-3.2 7.2-7.2 7.2c-2.9 0-5.5-1.8-6.6-4.4-.2-.5-.7-.8-1.2-.7-.7.1-1.1.8-.9 1.4 1.4 3.6 4.9 6 8.8 6 5.4 0 9.8-4.4 9.8-9.8S17.5 2.1 12.1 2.1zm0 5.4c-2.4 0-4.4 2-4.4 4.4s2 4.4 4.4 4.4 4.4-2 4.4-4.4-2-4.4-4.4-4.4zm0 2.2c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2-2.2-1-2.2-2.2 1-2.2 2.2-2.2z"
      />
    </SvgShell>
  )
}

export function GoogleDriveMcpIcon({ className, title = 'Google Drive' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path fill="#0066DA" d="M8.3 3.5 1.5 15.2h4.6L13 3.5z" />
      <path fill="#00AC47" d="m15.7 3.5-6.9 11.7h4.7L20.5 3.5z" />
      <path fill="#EA4335" d="M8.25 20.5 4 13.2H1.5l4.25 7.3z" />
      <path fill="#00832D" d="m15.7 20.5-2.3-4-2.35 4z" />
      <path fill="#2684FC" d="M20.5 13.2h-4.7l-2.3 4h4.65z" />
      <path fill="#FFBA00" d="m13 3.5-2.35 4h4.7z" />
    </SvgShell>
  )
}

export function SlackMcpIcon({ className, title = 'Slack' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path fill="#E01E5A" d="M9.1 14.6a1.65 1.65 0 1 1-1.65-1.65h1.65v1.65Zm.83 0A1.65 1.65 0 0 1 11.58 13V6.35A1.65 1.65 0 1 0 9.93 8v6.6Z" />
      <path fill="#36C5F0" d="M9.93 9.1a1.65 1.65 0 1 1 1.65-1.65V9.1H9.93Zm0 .83A1.65 1.65 0 0 1 11.58 11.58h6.6a1.65 1.65 0 1 0-1.65-1.65H9.93Z" />
      <path fill="#2EB67D" d="M15.07 9.93a1.65 1.65 0 1 1 1.65 1.65h-1.65V9.93Zm-.83 0A1.65 1.65 0 0 1 12.59 11.58v6.6a1.65 1.65 0 1 0 1.65-1.65V9.93Z" />
      <path fill="#ECB22E" d="M14.24 15.07a1.65 1.65 0 1 1-1.65 1.65v-1.65h1.65Zm0-.83A1.65 1.65 0 0 1 12.59 12.59H6a1.65 1.65 0 1 0 1.65 1.65h6.6Z" />
    </SvgShell>
  )
}

export function GmailMcpIcon({ className, title = 'Gmail' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path fill="#4285F4" d="M3.5 6.75v10.5c0 .69.56 1.25 1.25 1.25H7.5V11.4L3.5 8.4z" />
      <path fill="#34A853" d="M20.5 6.75v10.5c0 .69-.56 1.25-1.25 1.25H16.5V11.4l4-3z" />
      <path fill="#C5221F" d="M20.5 6.75 12 13.1 3.5 6.75A1.25 1.25 0 0 1 4.75 5.5h14.5c.69 0 1.25.56 1.25 1.25Z" />
      <path fill="#FBBC04" d="M7.5 11.4v7.1h9V11.4L12 14.75z" />
    </SvgShell>
  )
}

export function OpenAIMcpIcon({ className, title = 'OpenAI' }: IconProps) {
  return (
    <SvgShell className={className} title={title}>
      <path
        fill="currentColor"
        d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .517 4.91 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.055 6.055 0 0 0-.747-7.073zM13.26 22.43a3.994 3.994 0 0 1-2.573-.98l.128-.073 4.279-2.471a.7.7 0 0 0 .348-.602V11.3l1.808 1.043c.10.0.1.2.05.158v5.003a4.005 4.005 0 0 1-4.04 4.925zM3.96 17.29a3.99 3.99 0 0 1-.479-2.687l.128.077 4.28 2.472a.69.69 0 0 0 .696 0l5.223-3.016v2.086a.17.17 0 0 1-.066.14l-4.33 2.5a4.005 4.005 0 0 1-5.452-.572zm-.735-8.68a3.998 3.998 0 0 1 2.09-1.79l-.001.105v4.965a.69.69 0 0 0 .348.601l5.223 3.016-1.808 1.043a.17.17 0 0 1-.158.013l-4.33-2.5a4.005 4.005 0 0 1-1.364-5.453zm16.146 3.81-5.223-3.016 1.808-1.042a.17.17 0 0 1 .158-.013l4.33 2.5a4.005 4.005 0 0 1-.605 7.214v-5.05a.69.69 0 0 0-.347-.602zm1.98-2.7-.128-.076-4.28-2.473a.69.69 0 0 0-.696 0L11.034 9.39V7.304a.17.17 0 0 1 .066-.14l4.33-2.499a4.005 4.005 0 0 1 5.921 4.154zM8.57 12.866l-1.808-1.043a.17.17 0 0 1-.05-.158V6.662a4.005 4.005 0 0 1 6.573-3.078l-.128.073-4.279 2.471a.7.7 0 0 0-.348.602zm1.096-2.108L12 9.05l2.334 1.348v2.696L12 14.442l-2.334-1.348z"
      />
    </SvgShell>
  )
}

const MCP_ICON_MAP: Record<string, (props: IconProps) => ReactElement> = {
  github: GitHubMcpIcon,
  linear: LinearMcpIcon,
  supabase: SupabaseMcpIcon,
  datadog: DatadogMcpIcon,
  'google-drive': GoogleDriveMcpIcon,
  googledrive: GoogleDriveMcpIcon,
  slack: SlackMcpIcon,
  gmail: GmailMcpIcon,
  openai: OpenAIMcpIcon,
  openrouter: OpenAIMcpIcon,
  'openai-openrouter': OpenAIMcpIcon,
  'openai-openroute': OpenAIMcpIcon,
}

export function resolveMcpIconKey(idOrName: string): string {
  return idOrName
    .toLowerCase()
    .replace(/^.*:/, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function McpBrandIcon({
  id,
  name,
  className,
}: {
  id: string
  name?: string
  className?: string
}) {
  const key = resolveMcpIconKey(id)
  const altKey = name ? resolveMcpIconKey(name) : ''
  const Icon =
    MCP_ICON_MAP[key] ||
    MCP_ICON_MAP[altKey] ||
    MCP_ICON_MAP[key.replace(/-/g, '')] ||
    null

  if (Icon) {
    return <Icon className={className} title={name || id} />
  }

  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 items-center justify-center rounded-[4px] bg-white/10 text-[9px] font-bold uppercase text-white/80',
        className,
      )}
      aria-hidden
    >
      {(name || id).slice(0, 1)}
    </span>
  )
}
