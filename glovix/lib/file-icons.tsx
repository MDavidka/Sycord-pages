'use client'

import { useMemo } from 'react'
import { File as LucideFile } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons'

export type FileIconKind =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'html'
  | 'markdown'
  | 'react'
  | 'nodejs'
  | 'docker'
  | 'git'
  | 'nextjs'
  | 'json'
  | 'generic'

const ICON_SRC: Record<Exclude<FileIconKind, 'generic'>, string> = {
  typescript: `${DEVICON}/typescript/typescript-original.svg`,
  javascript: `${DEVICON}/javascript/javascript-original.svg`,
  python: `${DEVICON}/python/python-original.svg`,
  html: `${DEVICON}/html5/html5-original.svg`,
  markdown: `${DEVICON}/markdown/markdown-original.svg`,
  react: `${DEVICON}/react/react-original.svg`,
  nodejs: `${DEVICON}/nodejs/nodejs-original.svg`,
  docker: `${DEVICON}/docker/docker-original.svg`,
  git: `${DEVICON}/git/git-original.svg`,
  nextjs: `${DEVICON}/nextjs/nextjs-original.svg`,
  json: `${DEVICON}/json/json-original.svg`,
}

/** Yellow accent used for .tsx/.jsx/.js chips in the agent feed (matches Syra mock). */
export const FILE_ACCENT: Record<FileIconKind, string> = {
  typescript: '#7DD3FC',
  javascript: '#FACC15',
  python: '#60A5FA',
  html: '#FB923C',
  markdown: '#A1A1AA',
  react: '#67E8F9',
  nodejs: '#4ADE80',
  docker: '#38BDF8',
  git: '#F87171',
  nextjs: '#E4E4E7',
  json: '#FBBF24',
  generic: 'rgba(255,255,255,0.55)',
}

export function getFileIconKind(pathOrName: string): FileIconKind {
  const base = pathOrName.split('/').pop()?.toLowerCase() || ''
  const ext = base.includes('.') ? base.split('.').pop() || '' : ''

  if (base === 'dockerfile' || base.startsWith('dockerfile.') || ext === 'dockerfile') return 'docker'
  if (base === 'package.json' || base === 'package-lock.json' || base === 'pnpm-lock.yaml') return 'nodejs'
  if (base === 'next.config.js' || base === 'next.config.mjs' || base === 'next.config.ts') return 'nextjs'
  if (base === '.gitignore' || base.endsWith('.gitattributes')) return 'git'

  switch (ext) {
    case 'tsx':
    case 'jsx':
      return 'react'
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'py':
      return 'python'
    case 'html':
    case 'htm':
      return 'html'
    case 'md':
    case 'mdx':
      return 'markdown'
    case 'json':
      return 'json'
    case 'yml':
    case 'yaml':
      // Prefer generic muted tone for yaml; docker-compose uses docker
      return base.includes('docker') ? 'docker' : 'generic'
    default:
      return 'generic'
  }
}

/** Filename accent — .tsx/.jsx/.js are yellow like the Syra feed mock. */
export function getFileNameAccent(pathOrName: string): string {
  const base = pathOrName.split('/').pop()?.toLowerCase() || ''
  const ext = base.includes('.') ? base.split('.').pop() || '' : ''
  if (ext === 'tsx' || ext === 'jsx' || ext === 'js' || ext === 'mjs' || ext === 'cjs') {
    return '#FACC15'
  }
  if (ext === 'ts' || ext === 'mts' || ext === 'cts') {
    return '#7DD3FC'
  }
  return FILE_ACCENT[getFileIconKind(pathOrName)]
}

export function FileTypeIcon({
  path,
  className,
  size = 14,
}: {
  path: string
  className?: string
  size?: number
}) {
  const kind = useMemo(() => getFileIconKind(path), [path])
  if (kind === 'generic') {
    return <LucideFile className={cn('shrink-0 text-white/45', className)} style={{ width: size, height: size }} strokeWidth={1.8} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ICON_SRC[kind]}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      draggable={false}
    />
  )
}
