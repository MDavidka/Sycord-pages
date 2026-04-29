"use client"

/**
 * Landing page designed against an 832 x 1792 mobile canvas.
 * Positions, sizes, and spacing are expressed as percentages of that canvas
 * so the layout scales smoothly across mobile viewports while preserving the
 * reference proportions.
 */
export default function LandingPage() {
  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-[#131416] text-white"
      style={{
        // Subtle dotted grid pattern across the entire background.
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        backgroundPosition: "0 0",
      }}
    >
      {/* Logo: open-book / two-panel shape, light gray. */}
      <div
        aria-label="Logo"
        className="absolute"
        style={{
          left: "13.22%", // 110 / 832
          top: "9.93%", // 178 / 1792
          width: "8.4vw",
          maxWidth: "70px",
          minWidth: "44px",
        }}
      >
        <svg
          viewBox="0 0 64 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
          aria-hidden="true"
        >
          {/* Two panels meeting in the middle, like an open book. */}
          <path
            d="M2 4 L30 12 L30 38 L2 30 Z"
            fill="#9aa0a6"
          />
          <path
            d="M62 4 L34 12 L34 38 L62 30 Z"
            fill="#9aa0a6"
          />
        </svg>
      </div>

      {/* Top-right pill button with circular M icon on the right. */}
      <div
        className="absolute flex items-center justify-end rounded-full bg-[#1d1e21]"
        style={{
          left: "58.65%", // 488 / 832
          top: "8.65%", // 155 / 1792
          width: "31.25%", // 260 / 832
          height: "4.18%", // 75 / 1792
          minHeight: "38px",
          maxHeight: "60px",
          paddingRight: "0.6%",
        }}
      >
        <div
          className="flex aspect-square h-[80%] items-center justify-center rounded-full bg-[#0f1012]"
          aria-label="User"
        >
          <span
            className="font-bold text-white"
            style={{ fontSize: "clamp(12px, 3.2vw, 22px)", lineHeight: 1 }}
          >
            M
          </span>
        </div>
      </div>

      {/* Hero headline */}
      <h1
        className="absolute left-1/2 -translate-x-1/2 text-center font-extrabold tracking-tight"
        style={{
          top: "25.11%", // 450 / 1792
          width: "92%",
          fontSize: "clamp(34px, 7.93vw, 66px)", // 66 / 832 of viewport width
          lineHeight: 1.2,
          fontWeight: 800,
        }}
      >
        <span className="text-white">Create </span>
        <span className="text-[#9aa0a6]">your site</span>
        <br />
        <span className="text-white">under a minute</span>
      </h1>

      {/* Two outlined "Button" buttons */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
        style={{
          top: "42.69%", // 765 / 1792
          gap: "7.21vw", // 60 / 832 of viewport width
        }}
      >
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            className="rounded-[18px] border border-[#34363a] bg-transparent text-[#c9ccd1] transition-colors hover:bg-white/5"
            style={{
              width: "18.63vw", // 155 / 832
              height: "8.59vw", // 72 / 832
              minWidth: "92px",
              minHeight: "44px",
              maxWidth: "155px",
              maxHeight: "72px",
              fontSize: "clamp(14px, 3.36vw, 28px)",
              fontWeight: 600,
            }}
          >
            Button
          </button>
        ))}
      </div>

      {/* Lower placeholder card / mockup area */}
      <div
        className="absolute bg-[#28292d]"
        style={{
          top: "57.76%", // 1035 / 1792
          left: "4.09%", // 34 / 832
          right: "4.09%",
          bottom: 0,
          borderTopLeftRadius: "clamp(28px, 6.61vw, 55px)",
          borderTopRightRadius: "clamp(28px, 6.61vw, 55px)",
        }}
      />
    </main>
  )
}
