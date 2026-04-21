"use client"
import { signIn } from "next-auth/react"

export default function Bypass() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <button
        onClick={() => signIn("bypass", { email: "dmarton336@gmail.com", callbackUrl: "/dashboard" })}
        className="px-4 py-2 bg-zinc-800 rounded text-sm hover:bg-zinc-700"
      >
        Login as Admin (Bypass)
      </button>
    </div>
  )
}
