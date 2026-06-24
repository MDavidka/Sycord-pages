"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"

/* ─── Default report data (overridden by DB values on load) ─── */
const OWNER_NAME = "Dávid Márton"
const BUSINESS_NAME = "Sycord"
const WEBSITE_URL = "https://sycord.com"
const REPORT_DATE = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
})
const DOC_REF = `BAR-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

const PLANS = [
  { name: "Sycord (Free)",     price: "$0",  period: "N/A",     features: "1 website · 1 GB storage · Basic templates · *.sycord.com subdomain" },
  { name: "Sycord+ (Pro)",     price: "$9",  period: "Monthly", features: "Unlimited websites · 50 GB storage · AI Builder · Custom domain · Analytics" },
  { name: "Sycord Enterprise", price: "$29", period: "Monthly", features: "Everything in Pro · 500 GB storage · Priority support · API access · Team collaboration" },
]

const SERVICES = [
  { title: "AI Website Builder",       desc: "Users describe their desired website in plain English; the platform generates a complete, production-ready website automatically using Google Gemini AI." },
  { title: "No-Code Visual Editor",    desc: "A drag-and-drop editor with real-time preview allows full customisation without writing any code." },
  { title: "Instant Hosting",          desc: "Every website receives a free *.sycord.com subdomain with one-click publishing. Custom domains are available on paid plans." },
  { title: "GitHub Deployment",        desc: "Source code is automatically pushed to a GitHub repository, providing built-in CI/CD pipelines and version control." },
  { title: "Firebase Real-Time Sync",  desc: "Real-time data synchronisation via Firebase ensures instant updates across all devices." },
  { title: "Content Moderation",       desc: "Automated AI-based content filtering maintains platform safety for all users." },
]

export default function BusinessReportPage() {
  const docContainerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  /* ── Load saved fields from MongoDB on first mount ── */
  useEffect(() => {
    fetch("/api/business-report")
      .then((r) => r.json())
      .then((data: { fields: Record<string, string> | null }) => {
        if (!data.fields) return
        const root = docContainerRef.current
        if (!root) return
        for (const [fieldId, content] of Object.entries(data.fields)) {
          const el = root.querySelector(`[data-field="${fieldId}"]`)
          if (el) el.textContent = content
        }
      })
      .catch((err) => {
        console.warn("[business-report] Could not load saved fields:", err)
      })
  }, [])

  /* ── Debounced auto-save to MongoDB ── */
  function scheduleAutoSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus("saving")
    saveTimerRef.current = setTimeout(async () => {
      try {
        const root = docContainerRef.current
        if (!root) return
        const fields: Record<string, string> = {}
        root.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
          const id = el.getAttribute("data-field")!
          fields[id] = el.textContent ?? ""
        })
        const res = await fetch("/api/business-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        })
        setSaveStatus(res.ok ? "saved" : "error")
      } catch {
        setSaveStatus("error")
      } finally {
        setTimeout(() => setSaveStatus("idle"), 3000)
      }
    }, 1500)
  }

  return (
    <>
      {/* ── Print / A4 / Mobile CSS ── */}
      <style>{`
        @page { size: A4 portrait; margin: 2.5cm 2cm 2cm 2.5cm; }

        @media print {
          html, body { width: 210mm; min-height: 297mm; background: #fff !important; color: #000 !important; font-size: 10pt !important; }
          .no-print { display: none !important; }
          .a4-outer { padding: 0 !important; background: transparent !important; }
          .a4-page  { width: 100% !important; min-height: auto !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          .doc-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
          a { color: #000 !important; text-decoration: none !important; }
          [contenteditable] { outline: none !important; border: none !important; }
        }

        @media screen and (min-width: 794px) {
          .a4-page { width: 794px; min-height: 1123px; padding: 96px 76px 76px 96px; margin: 0 auto; background: #fff; box-shadow: 0 4px 40px rgba(0,0,0,0.18); border-radius: 2px; }
        }

        @media screen and (max-width: 793px) {
          .a4-outer { padding: 0 !important; }
          .a4-page { width: 100%; min-height: auto; padding: 20px 16px 32px; margin: 0; background: #fff; box-shadow: none; border-radius: 0; font-size: 11px !important; }
          .report-doc-header { flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
          .report-doc-header-right { text-align: left !important; }
          .report-doc-header-right p:first-child { font-size: 15px !important; }
          .report-footer { flex-direction: column !important; gap: 20px !important; align-items: flex-start !important; }
          .report-sig { text-align: left !important; }
          .legal-table td { display: block !important; width: 100% !important; }
          .legal-table tr { display: block; margin-bottom: 4px; }
          .services-table thead { display: none; }
          .services-table tbody tr td:first-child { font-size: 11px; background: #1a1a1a; color: #fff !important; display: block; width: 100%; }
          .services-table tbody tr td:last-child { display: block; width: 100%; }
          .plans-table thead { display: none; }
          .plans-table tbody tr td { display: block; width: 100%; }
          .plans-table tbody tr { display: block; border: 1px solid #ddd; margin-bottom: 8px; border-radius: 4px; overflow: hidden; }
        }

        @media screen {
          [contenteditable="true"] { cursor: text; border-radius: 2px; transition: outline 0.15s; }
          [contenteditable="true"]:hover, [contenteditable="true"]:focus { outline: 1.5px dashed #2563eb44; background: #eff6ff33; }
          [contenteditable="true"]:focus { outline: 1.5px solid #2563eb88; background: #eff6ff55; }
        }
      `}</style>

      {/* ── Screen toolbar ── */}
      <div className="no-print sticky top-0 z-50 bg-[#18191B] border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Image src="/logo.png" alt="Sycord" width={22} height={22} className="opacity-90" />
          <span className="text-white font-bold text-sm tracking-tight">Sycord</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Save status */}
          {saveStatus === "saving" && (
            <span className="text-[#8A8E91] text-xs">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-emerald-400 text-xs">✓ Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-400 text-xs">Save failed</span>
          )}
          {saveStatus === "idle" && (
            <span className="text-[#8A8E91] text-xs hidden sm:block">✎ Click any field to edit</span>
          )}
          <Button
            onClick={() => window.print()}
            className="bg-white text-[#18191B] hover:bg-white/90 text-xs font-semibold px-4 h-8 rounded-full flex items-center gap-1.5 flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      {/* ── Background wrapper ── */}
      <div className="a4-outer min-h-screen bg-[#E8E8E8] py-6 sm:py-10 px-0 sm:px-4">

        {/* ═══ A4 DOCUMENT ═══ */}
        <div
          className="a4-page"
          ref={docContainerRef}
          onInput={scheduleAutoSave}
        >

          {/* ── Document Header ── */}
          <header className="doc-header report-doc-header mb-6 sm:mb-8 pb-4 sm:pb-6 border-b-2 border-[#1a1a1a] flex items-start justify-between gap-3">
            {/* Left: official Sycord logo from sycord.com */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://sycord.com/logo.png"
                  alt="Sycord"
                  width={40}
                  height={40}
                  style={{ borderRadius: "6px", display: "block", objectFit: "contain" }}
                />
              </div>
              <div>
                <EF tag="p" fieldId="header-business-name" className="text-[11pt] font-black text-[#1a1a1a] tracking-tight leading-none">{BUSINESS_NAME}</EF>
                <EF tag="p" fieldId="header-website-url" className="text-[8pt] text-[#555] mt-0.5">{WEBSITE_URL}</EF>
              </div>
            </div>

            {/* Right: document title + ref */}
            <div className="report-doc-header-right text-right">
              <EF tag="p" fieldId="header-doc-title" className="text-[13pt] sm:text-[14pt] font-bold text-[#1a1a1a] leading-tight">BUSINESS ACTIVITY REPORT</EF>
              <EF tag="p" fieldId="header-doc-ref" className="text-[8pt] text-[#666] mt-1">Document Ref: {DOC_REF}</EF>
              <EF tag="p" fieldId="header-date" className="text-[8pt] text-[#666]">Date: {REPORT_DATE}</EF>
            </div>
          </header>

          {/* ── Introductory notice ── */}
          <EF
            tag="div"
            fieldId="intro"
            className="mb-6 sm:mb-8 p-3 border border-[#c0c0c0] bg-[#f9f9f9] text-[8.5pt] text-[#444] leading-relaxed"
          >
            This document constitutes an official Business Activity Report prepared by {OWNER_NAME} on behalf of {BUSINESS_NAME}. It has been compiled for regulatory, financial, or partnership compliance purposes and reflects the business activities as of the date stated above.
          </EF>

          {/* ── SECTION 1: Legal Identity ── */}
          <DocSection number="1" sectionId="s1" title="Legal Identity">
            <LegalTable tableId="s1-legal" rows={[
              ["Full Legal Name",    OWNER_NAME],
              ["Trading Name",       BUSINESS_NAME],
              ["Business Type",      "Software-as-a-Service (SaaS) — Sole Trader / Individual"],
              ["Website",            WEBSITE_URL],
              ["Document Date",      REPORT_DATE],
              ["Document Reference", DOC_REF],
            ]} />
          </DocSection>

          {/* ── SECTION 2: Business Overview ── */}
          <DocSection number="2" sectionId="s2" title="Business Overview">
            <EF tag="p" fieldId="s2-p1" className="text-[9pt] text-[#333] leading-[1.65] mb-3">
              Sycord is an AI-powered website-building platform that enables individuals and businesses to create, customise, and publish professional websites in under five minutes — without any coding knowledge. The platform combines large-language-model AI (Google Gemini) with an intuitive visual editor to automate code generation, design, and deployment.
            </EF>
            <EF tag="p" fieldId="s2-p2" className="text-[9pt] text-[#333] leading-[1.65]">
              The service is offered exclusively as a Software-as-a-Service (SaaS) product, accessible via web browser at {WEBSITE_URL}. No physical goods are manufactured or distributed. All services are delivered digitally over the internet.
            </EF>
          </DocSection>

          {/* ── SECTION 3: Services & Products ── */}
          <DocSection number="3" sectionId="s3" title="Services and Products Offered">
            <div className="overflow-x-auto">
              <table className="services-table w-full text-[8.5pt] border-collapse" style={{ minWidth: "280px" }}>
                <thead>
                  <tr style={{ background: "#1a1a1a", color: "#fff" }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ width: "32%" }}>Service</th>
                    <th className="text-left px-3 py-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {SERVICES.map((s, i) => (
                    <tr key={s.title} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                      <td className="px-3 py-2 font-semibold text-[#1a1a1a] align-top border border-[#ddd]">
                        <EF fieldId={`s3-svc-${i}-title`}>{s.title}</EF>
                      </td>
                      <td className="px-3 py-2 text-[#444] leading-[1.5] border border-[#ddd]">
                        <EF fieldId={`s3-svc-${i}-desc`}>{s.desc}</EF>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* ── SECTION 4: Subscription Plans ── */}
          <DocSection number="4" sectionId="s4" title="Subscription Plans and Pricing">
            <EF tag="p" fieldId="s4-intro" className="text-[9pt] text-[#333] leading-[1.65] mb-3">
              Sycord offers three subscription tiers billed on a monthly basis. Payments are collected online via PayPal&apos;s secure checkout infrastructure upon checkout completion. All prices are stated in United States Dollars (USD).
            </EF>
            <div className="overflow-x-auto">
              <table className="plans-table w-full text-[8.5pt] border-collapse" style={{ minWidth: "280px" }}>
                <thead>
                  <tr style={{ background: "#1a1a1a", color: "#fff" }}>
                    <th className="text-left px-3 py-2 font-semibold">Plan</th>
                    <th className="text-left px-3 py-2 font-semibold">Price</th>
                    <th className="text-left px-3 py-2 font-semibold">Billing</th>
                    <th className="text-left px-3 py-2 font-semibold">Included Features</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANS.map((p, i) => (
                    <tr key={p.name} style={{ background: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
                      <td className="px-3 py-2 font-semibold border border-[#ddd] align-top"><EF fieldId={`s4-plan-${i}-name`}>{p.name}</EF></td>
                      <td className="px-3 py-2 border border-[#ddd] align-top font-mono"><EF fieldId={`s4-plan-${i}-price`}>{p.price} USD</EF></td>
                      <td className="px-3 py-2 border border-[#ddd] align-top"><EF fieldId={`s4-plan-${i}-period`}>{p.period}</EF></td>
                      <td className="px-3 py-2 border border-[#ddd] text-[#444]"><EF fieldId={`s4-plan-${i}-features`}>{p.features}</EF></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>

          {/* ── SECTION 5: Payment Collection ── */}
          <DocSection number="5" sectionId="s5" title="Payment Collection Method">
            <EF tag="p" fieldId="s5-intro" className="text-[9pt] text-[#333] leading-[1.65] mb-3">
              All monetary transactions are processed exclusively through PayPal&apos;s secure payment infrastructure. Sycord does not handle, transmit, or store any payment card data directly. The payment flow is as follows:
            </EF>
            <ol className="list-decimal list-outside ml-5 text-[9pt] text-[#333] leading-[1.65] space-y-1 mb-3">
              <li><EF fieldId="s5-li-0">The customer selects a subscription plan on the Sycord website.</EF></li>
              <li><EF fieldId="s5-li-1">The customer clicks the &ldquo;Pay with PayPal&rdquo; button.</EF></li>
              <li><EF fieldId="s5-li-2">The customer is securely redirected to PayPal to authorise the payment.</EF></li>
              <li><EF fieldId="s5-li-3">Upon successful authorisation, PayPal redirects the customer back to Sycord and the subscription is activated.</EF></li>
            </ol>
            <LegalTable tableId="s5-pay" rows={[
              ["Payment Processor",  "PayPal (PayPal Holdings, Inc.)"],
              ["API Endpoint",       "api-m.paypal.com (production) / api-m.sandbox.paypal.com (testing)"],
              ["Collection Point",   WEBSITE_URL + " — /subscriptions (checkout page)"],
              ["Supported Currency", "United States Dollar (USD)"],
              ["Billing Cycle",      "Monthly recurring subscription"],
              ["Refund Policy",      "Subject to PayPal Buyer Protection and Sycord Terms of Service"],
            ]} />
          </DocSection>

          {/* ── SECTION 6: Branding & Online Presence ── */}
          <DocSection number="6" sectionId="s6" title="Branding and Online Presence">
            <LegalTable tableId="s6-brand" rows={[
              ["Brand Name",        BUSINESS_NAME],
              ["Primary Website",   WEBSITE_URL],
              ["About Page",        WEBSITE_URL + "/about"],
              ["Pricing Page",      WEBSITE_URL + "/subscriptions"],
              ["Terms of Service",  WEBSITE_URL + "/tos"],
              ["Privacy Policy",    WEBSITE_URL + "/pap"],
              ["Contact",           WEBSITE_URL + "/contact"],
            ]} />
          </DocSection>

          {/* ── SECTION 7: Declaration ── */}
          <DocSection number="7" sectionId="s7" title="Declaration">
            <EF tag="p" fieldId="s7-declaration" className="text-[9pt] text-[#333] leading-[1.65] mb-4">
              I, {OWNER_NAME}, the sole owner and operator of {BUSINESS_NAME}, hereby declare that the information provided in this Business Activity Report is accurate, truthful, and complete to the best of my knowledge as of the date stated on this document. I accept full legal responsibility for the accuracy of the contents herein.
            </EF>
          </DocSection>

          {/* ── Document Footer / Signature ── */}
          <footer className="report-footer mt-8 sm:mt-10 pt-5 sm:pt-6 border-t-2 border-[#1a1a1a] flex items-end justify-between gap-6">
            {/* Left — metadata */}
            <div className="space-y-0.5">
              <EF tag="p" fieldId="footer-doc-ref"      className="text-[8pt] text-[#555]">Document reference: {DOC_REF}</EF>
              <EF tag="p" fieldId="footer-prepared-by"  className="text-[8pt] text-[#555]">Prepared by: {OWNER_NAME}</EF>
              <EF tag="p" fieldId="footer-date"         className="text-[8pt] text-[#555]">Date: {REPORT_DATE}</EF>
              <EF tag="p" fieldId="footer-url"          className="text-[8pt] text-[#555] pt-1">{WEBSITE_URL}</EF>
            </div>

            {/* Right — signature block */}
            <div className="report-sig text-right">
              <p className="text-[7.5pt] text-[#999] uppercase tracking-widest mb-2">Authorised Signature</p>
              {/* Cursive "Márton" signature — hand-traced SVG paths */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 340 110"
                width="170"
                height="55"
                aria-label="Dávid Márton signature"
                style={{ display: "block", marginLeft: "auto" }}
              >
                <g fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 18,82 C 12,78 8,62 10,48 C 12,36 16,30 20,36 C 22,42 20,70 22,80"/>
                  <path d="M 22,80 C 24,74 26,40 30,28 C 34,16 36,60 40,76 C 42,70 46,38 50,26 C 54,14 58,62 62,78"/>
                  <path d="M 62,78 C 66,72 72,54 78,48 C 84,44 82,62 80,70 C 78,78 86,54 92,46"/>
                  <path d="M 73,32 C 76,26 79,21 82,18"/>
                  <path d="M 92,46 C 92,52 90,68 92,76 C 96,70 102,54 108,48"/>
                  <path d="M 108,48 C 108,38 110,22 112,16 C 114,22 116,58 118,70 C 122,64 128,50 134,46"/>
                  <path d="M 100,42 L 126,40"/>
                  <path d="M 134,46 C 132,54 128,72 134,78 C 140,82 150,66 152,58 C 154,50 148,44 142,48 C 136,52 140,76 150,70"/>
                  <path d="M 150,70 C 152,74 154,80 158,74 C 164,64 170,50 176,46 C 182,42 184,62 186,74 C 188,82 196,72 204,64 C 208,60 210,72 210,78"/>
                </g>
              </svg>
              <div style={{ width: "170px", borderTop: "1px solid #bbb", marginTop: "6px", marginLeft: "auto" }} />
              <EF tag="p" fieldId="footer-sig-name" className="text-[8pt] text-[#555] mt-1">{OWNER_NAME}</EF>
            </div>
          </footer>

        </div>
        {/* ═══ END A4 DOCUMENT ═══ */}
      </div>
    </>
  )
}

/* ─────────────────── EditableField ─────────────────── */
/**
 * EF (EditableField) — renders a `contentEditable` element.
 * `fieldId` is stored as `data-field` so the save/load logic can
 * identify and populate the element by its stable key.
 */
function EF({
  children,
  tag = "span",
  fieldId,
  className,
  style,
}: {
  children?: React.ReactNode
  tag?: string
  fieldId?: string
  className?: string
  style?: React.CSSProperties
}) {
  const Tag = tag as React.ElementType
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      data-field={fieldId}
      className={className}
      style={style}
    >
      {children}
    </Tag>
  )
}

/* ─────────────────── DocSection ─────────────────── */
function DocSection({
  number,
  sectionId,
  title,
  children,
}: {
  number: string
  sectionId: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: "18pt" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8pt", borderBottom: "1.5pt solid #1a1a1a", paddingBottom: "3pt", marginBottom: "8pt" }}>
        <span style={{ fontSize: "8pt", fontWeight: 700, background: "#1a1a1a", color: "#fff", padding: "1pt 5pt", borderRadius: "2pt", flexShrink: 0, letterSpacing: "0.5pt" }}>
          {number}
        </span>
        <h2
          contentEditable
          suppressContentEditableWarning
          data-field={`${sectionId}-title`}
          style={{ fontSize: "10pt", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.8pt", margin: 0 }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

/* ─────────────────── LegalTable ─────────────────── */
function LegalTable({ tableId, rows }: { tableId: string; rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="legal-table w-full border-collapse" style={{ fontSize: "8.5pt" }}>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={label}>
              <td
                contentEditable
                suppressContentEditableWarning
                data-field={`${tableId}-row-${i}-label`}
                style={{ padding: "4pt 8pt", fontWeight: 600, color: "#444", width: "38%", borderBottom: "0.5pt solid #e0e0e0", verticalAlign: "top", backgroundColor: "#f5f5f5", minWidth: "100px" }}
              >
                {label}
              </td>
              <td
                contentEditable
                suppressContentEditableWarning
                data-field={`${tableId}-row-${i}-value`}
                style={{ padding: "4pt 8pt", color: "#222", borderBottom: "0.5pt solid #e0e0e0", verticalAlign: "top" }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
