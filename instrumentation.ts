export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[instrumentation] unhandledRejection:", reason)
    })
    process.on("uncaughtException", (error) => {
      console.error("[instrumentation] uncaughtException:", error)
    })
  }
}
