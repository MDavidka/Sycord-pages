import { Suspense } from "react"
import LoginForm from "@/components/login-form"

export default function LoginPage({ params: { lang } }: { params: { lang: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm lang={lang} />
    </Suspense>
  )
}
