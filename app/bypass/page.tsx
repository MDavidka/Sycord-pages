"use client"
import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"

export default function Bypass() {
  const [pending, setPending] = useState(false)

  const doBypass = async () => {
    if (pending) return
    setPending(true)
    await signIn("bypass", {
      email: "dmarton336@gmail.com",
      callbackUrl: "/dashboard",
      redirect: true,
    })
  }

  useEffect(() => {
    void doBypass()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <button
        onClick={doBypass}
        className="px-4 py-2 bg-zinc-800 rounded text-sm hover:bg-zinc-700"
      >
        {pending ? "Signing in..." : "Login as Admin (Bypass)"}
      </button>
    </div>
  )
}
