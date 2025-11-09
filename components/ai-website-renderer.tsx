"use client"

import { useEffect, useRef } from "react"

interface AIWebsiteRendererProps {
  code: string
  products: any[]
  businessName: string
}

export default function AIWebsiteRenderer({ code, products, businessName }: AIWebsiteRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="module">
            const products = ${JSON.stringify(products)};
            const businessName = "${businessName}";
            
            // Component code
            ${code}
          </script>
        </body>
      </html>
    `

    try {
      iframeRef.current.srcdoc = htmlContent
    } catch (error) {
      console.error("[v0] Failed to render AI website:", error)
    }
  }, [code, products, businessName])

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-screen border-none"
      title="AI Generated Website"
      sandbox="allow-same-origin allow-scripts allow-popups"
    />
  )
}
