import * as React from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Vite-friendly: read the current theme directly from the <html> element
// instead of using next-themes (which is Next.js-specific).
function useHtmlTheme(): "light" | "dark" {
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light"
    return document.documentElement.classList.contains("dark") ? "dark" : "light"
  })

  React.useEffect(() => {
    if (typeof document === "undefined") return
    const el = document.documentElement
    const obs = new MutationObserver(() => {
      setTheme(el.classList.contains("dark") ? "dark" : "light")
    })
    obs.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useHtmlTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
