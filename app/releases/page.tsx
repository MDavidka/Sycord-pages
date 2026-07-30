import Link from "next/link"
import { getServerSession } from "next-auth/next"
import { ArrowLeft, ArrowUpRight, CalendarDays, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import ReleaseAdminForm from "@/components/release-admin-form"
import { isAdmin } from "@/lib/is-admin"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"

type Release = {
  id: string
  title: string
  version: string
  summary: string
  imageUrl: string
  createdAt: string
}

const fallbackRelease: Release = {
  id: "private-alpha",
  title: "A quiet beginning",
  version: "0.1",
  summary: "Sycord is in private alpha. We are building the calmest way to move from an idea to something real — with one agent, global infrastructure, and room to explore.",
  imageUrl: "/hero-glass-bg.webp",
  createdAt: "2026-07-30T00:00:00.000Z",
}

async function getReleases(): Promise<Release[]> {
  try {
    const client = await clientPromise
    const documents = await client.db().collection("version_updates").find({ published: true }).sort({ createdAt: -1 }).toArray()
    if (!documents.length) return [fallbackRelease]
    return documents.map((document: any) => ({
      id: String(document._tid || document._id || document.id),
      title: String(document.title || "Untitled update"),
      version: String(document.version || "0.1"),
      summary: String(document.summary || ""),
      imageUrl: String(document.imageUrl || "/hero-glass-bg.webp"),
      createdAt: new Date(document.createdAt || Date.now()).toISOString(),
    }))
  } catch (error) {
    console.error("[releases] Unable to load version updates", error)
    return [fallbackRelease]
  }
}

export default async function ReleasesPage() {
  const [releases, session, configuredAdmin] = await Promise.all([getReleases(), getServerSession(authOptions), isAdmin()])
  const canEdit = configuredAdmin || session?.user?.email?.toLowerCase() === "dmarton336@gmail.com"

  return (
    <main className="min-h-screen bg-[#181818] px-5 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"><ArrowLeft className="size-4" /> Back home</Link>
          <Link href="/login" className="text-sm font-semibold text-white/55 transition-colors hover:text-white">Sign in <ArrowUpRight className="ml-1 inline size-3.5" /></Link>
        </header>

        <section className="relative mt-20 overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#1c1d21] px-7 py-12 sm:px-12 sm:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_15%,rgba(124,111,245,0.2),transparent_44%)]" />
          <div className="relative max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/45"><Sparkles className="size-3.5 text-[#a79cff]" /> Version journal</div><h1 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] sm:text-6xl">Small steps.<br /><span className="text-white/45">Visible progress.</span></h1><p className="mt-5 max-w-xl text-base leading-relaxed text-white/55">Notes from the build: what changed, what we are learning, and what is coming next.</p></div>
        </section>

        <div className="mt-14 flex items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Latest versions</p><h2 className="mt-2 text-2xl font-bold tracking-tight">From the workshop</h2></div><span className="hidden text-sm text-white/35 sm:block">{releases.length} update{releases.length === 1 ? "" : "s"}</span></div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {releases.map((release) => <ReleaseCard key={release.id} release={release} />)}
        </div>

        {canEdit && <section className="mt-16"><div className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Admin workspace</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Publish a version note</h2></div><ReleaseAdminForm /></section>}
      </div>
    </main>
  )
}

function ReleaseCard({ release }: { release: Release }) {
  const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(release.createdAt))
  return (
    <Card className="overflow-hidden rounded-[28px] border-white/[0.08] bg-[#1c1d21] py-0 text-white shadow-none">
      <div className="relative aspect-[16/8] overflow-hidden border-b border-white/[0.08] bg-[#151619]">
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 hover:scale-105" style={{ backgroundImage: `linear-gradient(135deg, rgba(20,20,24,.15), rgba(20,20,24,.62)), url("${release.imageUrl.replace(/"/g, "")}")` }} />
        <div className="absolute left-5 top-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/75"><span className="h-2 w-2 rounded-full bg-[#a79cff] shadow-[0_0_14px_#a79cff]" /> {release.version}</div>
      </div>
      <CardHeader className="gap-3 px-6 pb-3 pt-6"><CardTitle className="text-2xl tracking-[-0.03em]">{release.title}</CardTitle><CardDescription className="flex items-center gap-2 text-white/35"><CalendarDays className="size-3.5" /> {date}</CardDescription></CardHeader>
      <CardContent className="px-6 pb-7"><p className="text-sm leading-relaxed text-white/55">{release.summary}</p></CardContent>
    </Card>
  )
}
