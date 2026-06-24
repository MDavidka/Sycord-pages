"use client"

import { useCallback, useState } from "react"
import { Download } from "lucide-react"

/* ── plain-text version of every ToS section (used by the A4 renderer) ── */
const sections = [
  {
    title: "1. Bevezető Rendelkezések",
    items: [
      '1.1 Szolgáltató: A Sycord platformot (a továbbiakban: "Szolgáltatás") a Sycord üzemelteti. Kapcsolat: admin@sycord.com.',
      "1.2 Tárgy: A jelen Általános Szerződési Feltételek (ÁSZF) szabályozzák a Sycord AI-alapú weboldalkészítő platform használatát, beleértve a weboldal-szerkesztést, tárhelyszolgáltatást, mesterséges intelligencia alapú kódgenerálást, GitHub-integrációt és domain-kezelést.",
      "1.3 Elfogadás: A Szolgáltatás használatával — ideértve a regisztrációt, bejelentkezést vagy bármely funkció igénybevételét — a Felhasználó elfogadja a jelen ÁSZF-et és az Adatvédelmi Irányelveket.",
      "1.4 Módosítás: A Sycord fenntartja a jogot a jelen feltételek egyoldalú módosítására. A változásokról a felhasználók a platformon keresztül értesítést kapnak. A Szolgáltatás további használata a módosított feltételek elfogadásának minősül.",
      "1.5 Hatály: A jelen ÁSZF 2026. március 15-től hatályos és visszavonásig érvényes.",
    ],
  },
  {
    title: "2. A Szolgáltatás Leírása",
    items: [
      "2.1 Weboldalkészítés: A Sycord lehetőséget biztosít weboldalak létrehozására, szerkesztésére és közzétételére vizuális szerkesztő és AI-alapú kódgenerátor segítségével, kódolási ismeretek nélkül.",
      "2.2 AI Kódgenerálás: A platform Google Gemini és DeepSeek mesterséges intelligencia modelleket használ HTML, CSS és TypeScript kód automatikus generálásához. A felhasználói promptok feldolgozásra kerülnek ezen külső AI szolgáltatók által.",
      "2.3 Tárhelyszolgáltatás: Az elkészült weboldalak a Sycord infrastruktúráján kerülnek közzétételre, egyedi aldomain (*.sycord.com) vagy egyéni domain alatt.",
      "2.4 GitHub Integráció: A weboldalak forráskódja GitHub repositorykba kerül telepítésre automatikus deployment folyamattal.",
      "2.5 Firebase Szinkronizáció: A szerkesztési adatok valós időben szinkronizálódnak Firebase infrastruktúrán keresztül, biztosítva az azonnali frissítéseket.",
      "2.6 Tartalomszűrés: A platform automatikus tartalommoderációt alkalmaz (szűrőrendszer) a nem megfelelő tartalmak kiszűrésére.",
    ],
  },
  {
    title: "3. Regisztráció és Fiókkezelés",
    items: [
      "3.1 Regisztráció: A Szolgáltatás igénybevételéhez Google-fiókkal történő bejelentkezés szükséges (Google OAuth). A regisztráció során a Sycord hozzáfér a felhasználó nevéhez, e-mail címéhez és profilképéhez.",
      "3.2 Hitelesség: A Felhasználó szavatolja, hogy a megadott adatok valósak és naprakészek. Hamis adatok megadása a fiók azonnali felfüggesztéséhez vezethet.",
      "3.3 Munkamenet: A bejelentkezési munkamenetek JWT tokeneken alapulnak, 30 napos lejárattal. A Sycord verzióalapú munkamenet-érvénytelenítést alkalmaz az egyidejű munkamenetek megakadályozására.",
      "3.4 Fiókbiztonság: A Felhasználó felelős a fiókjához tartozó Google-fiók biztonságáért. A Sycord nem vállal felelősséget illetéktelen hozzáférésből eredő károkért.",
      "3.5 Korhatár: A Szolgáltatás kizárólag 16 éven felüli személyek számára érhető el. 16 év alatti felhasználó észlelése esetén a fiók azonnali törlésre kerül.",
    ],
  },
  {
    title: "4. Előfizetési Csomagok és Díjszabás",
    items: [
      "4.1 Ingyenes csomag (Sycord): 1 weboldal, 1 GB tárhely, alap sablonok. Korlátozott funkciókészlet, AI-szerkesztő nem elérhető.",
      "4.2 Sycord+ ($9/hó): Korlátlan weboldalak, 50 GB tárhely, AI Builder hozzáférés, 1 egyéni domain.",
      "4.3 Sycord Enterprise ($29/hó): A Sycord+ csomag minden funkciója, 500 GB tárhely, korlátlan egyéni domain, prioritásos ügyfélszolgálat.",
      "4.4 Árváltoztatás: A Sycord fenntartja az árak módosításának jogát. Az érvényes számlázási ciklus végéig a korábbi ár érvényes marad.",
      "4.5 Előfizetés kezelése: Az előfizetési státusz az adminisztrációs rendszeren keresztül kerül kezelésre. A Felhasználó az előfizetés lemondását az ügyfélszolgálaton keresztül kérelmezheti.",
    ],
  },
  {
    title: "5. Felhasználói Tartalom és Szellemi Tulajdon",
    items: [
      "5.1 Felhasználói tartalom: A Felhasználó által feltöltött vagy generált tartalmak (szövegek, képek, kódok, elrendezések) a Felhasználó tulajdonát képezik.",
      "5.2 Licenc a Sycord részére: A tartalom feltöltésével a Felhasználó nem kizárólagos, visszavonható licencet ad a Sycordnak a tartalom tárolására, megjelenítésére és a Szolgáltatás működtetéséhez szükséges technikai feldolgozására.",
      "5.3 AI-generált tartalom: Az AI által generált kód (HTML, CSS, TypeScript) a Felhasználó rendelkezésére áll. A Sycord nem vállal garanciát az AI-generált kód pontosságára, biztonságára vagy harmadik fél szellemi tulajdonjogának megsértésének hiányára.",
      "5.4 Platform szellemi tulajdona: A Sycord márkanév, logó, forráskód, felhasználói felület és dizájn a Sycord kizárólagos szellemi tulajdonát képezik.",
      "5.5 Adminisztrátori hozzáférés: Fontos: A felhasználói tartalmak technikai okokból nem titkosított formában tárolódnak, és a rendszeradminisztrátorok számára hozzáférhetőek hibaelhárítás és karbantartás céljából.",
    ],
  },
  {
    title: "6. Elfogadható Használat és Tiltott Tevékenységek",
    items: [
      "6.1 Elfogadható használat: A Szolgáltatás kizárólag jogszerű célokra, weboldalak létrehozására és közzétételére használható.",
      "6.2 Tiltott tartalmak: Tilos bármilyen jogellenes, sértő, obszcén, gyűlöletkeltő, fenyegető, zaklatásnak minősülő, szerzői jogot sértő vagy mások személyiségi jogait sértő tartalom feltöltése vagy generálása.",
      "6.3 Technikai visszaélések: Tilos a platform biztonsági rendszereinek megkerülése, API-k visszaélésszerű használata, automatizált tömeges lekérdezések végrehajtása, vagy a rendszer túlterhelésére irányuló bármely tevékenység.",
      "6.4 AI visszaélés: Tilos az AI-szerkesztő használata rosszindulatú kód (malware, phishing oldalak, adatgyűjtő scriptek) generálására, vagy harmadik fél jogait sértő tartalom előállítására.",
      "6.5 Következmények: A jelen szabályok megsértése a fiók azonnali felfüggesztéséhez vagy végleges törléséhez vezethet, a Sycord egyoldalú döntése alapján, előzetes értesítés nélkül.",
    ],
  },
  {
    title: "7. AI Szolgáltatások és Harmadik Felek",
    items: [
      "7.1 AI szolgáltatók: A Sycord a Google Gemini (2.0 Flash / 3.1 Pro) és DeepSeek mesterséges intelligencia modelleket használja. A felhasználói promptok és projektadatok továbbításra kerülnek ezen szolgáltatók felé a kódgenerálás érdekében.",
      "7.2 Adatfelhasználás: Az AI szolgáltatók felé továbbított adatok nem kerülnek felhasználásra modell-tanítási célokra (ez a beállítás explicit módon le van tiltva a rendszerben).",
      "7.3 Google Cloud Platform: Az adatok a Google Cloud Platform és Firebase szerverein kerülnek tárolásra és feldolgozásra, az érvényes adatfeldolgozási megállapodásoknak (DPA) megfelelően.",
      "7.4 GitHub: A weboldalak forráskódja a Sycord GitHub szervezetén belüli repositorykba kerül telepítésre. A GitHub saját felhasználási feltételei és adatvédelmi szabályzata külön alkalmazandó.",
      "7.5 Felelősség: A Sycord nem vállal felelősséget a harmadik fél szolgáltatók (Google, GitHub, DeepSeek) rendszereinek kieséséért, adatvédelmi incidenseiért vagy szolgáltatás-változásaiért.",
    ],
  },
  {
    title: "8. Rendelkezésre Állás és Felelősségkorlátozás",
    items: [
      "8.1 Rendelkezésre állás: A Sycord törekszik a Szolgáltatás folyamatos elérhetőségére, azonban nem garantál 100%-os üzemidőt. Karbantartási szünetek előfordulhatnak.",
      '8.2 "Ahogy van" állapot: A Szolgáltatás "ahogy van" ("as is") és "ahogy elérhető" ("as available") alapon kerül nyújtásra, kifejezett vagy hallgatólagos garancia nélkül.',
      "8.3 AI pontosság: Az AI által generált tartalom hibákat tartalmazhat. A Sycord nem garantálja a generált kód helyességét, biztonságát vagy harmadik fél jogainak megsértésének hiányát. A Felhasználó felelős a generált tartalom áttekintéséért és használatáért.",
      "8.4 Felelősségkorlátozás: A Sycord maximális felelőssége nem haladhatja meg a Felhasználó által az utolsó 12 hónapban ténylegesen kifizetett előfizetési díjak összegét. Közvetett, következményi vagy különleges károkért a Sycord nem vállal felelősséget.",
      "8.5 Adatvesztés: A Sycord nem vállal felelősséget a Felhasználó által feltöltött tartalmak elvesztéséért. A Felhasználó felelős a saját tartalmai rendszeres mentéséért.",
    ],
  },
  {
    title: "9. Fiók Felfüggesztése és Megszüntetése",
    items: [
      "9.1 Felhasználó általi megszüntetés: A Felhasználó bármikor kérelmezheti fiókja törlését az admin@sycord.com címen.",
      "9.2 Sycord általi felfüggesztés: A Sycord jogosult a fiók azonnali felfüggesztésére vagy törlésére a jelen ÁSZF megsértése, jogellenes tevékenység vagy a platform integritását veszélyeztető magatartás esetén.",
      "9.3 Adattörlés: A fiók megszüntetését követően a felhasználói adatok 30 napon belül törlésre kerülnek az éles adatbázisokból. A Firebase valós idejű adatok azonnal törlődnek. Biztonsági mentésekben az adatok további 60 napig maradhatnak.",
      "9.4 Közzétett weboldalak: A fiók törlése után az összes közzétett weboldal és a hozzájuk tartozó domain-konfigurációk deaktiválásra kerülnek.",
    ],
  },
  {
    title: "10. Adatvédelem",
    items: [
      "10.1 Adatkezelés: A személyes adatok kezelésére vonatkozó részletes szabályokat az Adatvédelmi Irányelvek tartalmazzák, amelyek a jelen ÁSZF elválaszthatatlan részét képezik.",
      "10.2 Gyűjtött adatok: Google-fiókadatok (név, e-mail, profilkép), IP-cím, munkamenet-adatok, feltöltött tartalmak és AI-promptok.",
      "10.3 GDPR megfelelőség: Az adatkezelés a GDPR (Általános Adatvédelmi Rendelet) 6. cikkében meghatározott jogalapoknak megfelelően történik.",
      "10.4 Felhasználói felelősség: Amennyiben a Felhasználó a saját weboldalán látogatói adatokat gyűjt, a Felhasználó minősül adatkezelőnek, a Sycord pedig adatfeldolgozónak ezen adatok tekintetében. A Felhasználó köteles biztosítani a saját adatkezelésének jogszerűségét.",
    ],
  },
  {
    title: "11. Domain-kezelés és Tárhely",
    items: [
      "11.1 Aldomain: Minden közzétett weboldal alapértelmezetten egy *.sycord.com aldomain alatt érhető el.",
      "11.2 Egyéni domain: A Sycord+ és Enterprise csomagok esetén a Felhasználó egyéni domaint csatlakoztathat. A domain regisztrációs és megújítási díjai a Felhasználót terhelik.",
      "11.3 Tárhelykorlátok: A tárhelyhasználat az előfizetési csomagnak megfelelő korlátokhoz kötött. A korlát túllépése a további feltöltések letiltásához vezethet.",
      "11.4 Aldomain fenntartás: A Sycord fenntartja a jogot az aldomain visszavonására, amennyiben az sértő, megtévesztő vagy jogsértő tartalmat tartalmaz.",
    ],
  },
  {
    title: "12. Záró Rendelkezések",
    items: [
      "12.1 Irányadó jog: A jelen ÁSZF-re a magyar jog az irányadó. Jogviták esetén a magyar bíróságok illetékesek.",
      "12.2 Részleges érvénytelenség: Amennyiben a jelen ÁSZF bármely rendelkezése érvénytelennek vagy végrehajthatatlannak bizonyul, az nem érinti a többi rendelkezés érvényességét.",
      "12.3 Teljes megállapodás: A jelen ÁSZF, az Adatvédelmi Irányelvekkel együtt, a Felek közötti teljes megállapodást képezi a Szolgáltatás használatával kapcsolatban.",
      "12.4 Kapcsolat: Kérdések, észrevételek vagy panaszok esetén forduljon hozzánk: admin@sycord.com.",
      "12.5 Verzió: Jelen dokumentum verziószáma: 1.0 – Utolsó frissítés: 2026.03.15.",
    ],
  },
]

/* ── A4 dimensions at 96 DPI ── */
const A4_W = 794
const A4_H = 1123
const PAGE_TOP = 50
const PAGE_BOTTOM = 50
const PAGE_LEFT = 60
const PAGE_RIGHT = 60
const CONTENT_W = A4_W - PAGE_LEFT - PAGE_RIGHT
const LOGO_SIZE = 28
const HEADER_GAP = 8
const DPR = 2

/* ── Font settings ── */
const bodyFont = "11.5px Inter, system-ui, sans-serif"
const sectionTitleFont = "bold 14px Inter, system-ui, sans-serif"
const lineHeight = 17
const sectionGap = 18
const itemGap = 5

/* ── Footer constants ── */
const SIGNER_NAME = "Dávid Márton"
const SIGNER_TITLE = "Alapító, Sycord"
const TOS_URL = "sycord.com/tos"

/* ── Canvas text helper ── */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width > maxWidth) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/* ── Represents a renderable block that can be placed on a page ── */
interface ContentBlock {
  type: "title" | "section-title" | "item" | "gap"
  height: number
  text?: string
  lines?: string[]
}

/* ── Measure all content blocks ── */
function measureBlocks(ctx: CanvasRenderingContext2D): ContentBlock[] {
  const blocks: ContentBlock[] = []

  /* Title + date */
  blocks.push({ type: "title", height: 28 + 16 + 16, text: "title" })

  for (const sec of sections) {
    /* Section title */
    blocks.push({
      type: "section-title",
      height: 18 + 8,
      text: sec.title,
    })

    for (const item of sec.items) {
      ctx.font = bodyFont
      const lines = wrapText(ctx, item, CONTENT_W)
      blocks.push({
        type: "item",
        height: lines.length * lineHeight + itemGap,
        lines,
      })
    }

    /* Gap after section */
    blocks.push({ type: "gap", height: sectionGap })
  }

  return blocks
}

/* ── Draw the letterhead on every page ── */
function drawLetterhead(
  ctx: CanvasRenderingContext2D,
  logoBmp: ImageBitmap,
): number {
  let y = PAGE_TOP

  ctx.drawImage(logoBmp, PAGE_LEFT, y, LOGO_SIZE, LOGO_SIZE)
  ctx.font = "bold 16px Inter, system-ui, sans-serif"
  ctx.fillStyle = "#18191B"
  ctx.textBaseline = "middle"
  ctx.fillText("Sycord", PAGE_LEFT + LOGO_SIZE + HEADER_GAP, y + LOGO_SIZE / 2)
  ctx.textBaseline = "alphabetic"
  y += LOGO_SIZE + 10

  ctx.strokeStyle = "#e2e2e2"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAGE_LEFT, y)
  ctx.lineTo(A4_W - PAGE_RIGHT, y)
  ctx.stroke()
  y += 20

  return y
}

/* ── Height reserved for the footer (signature + name + page number) ── */
const FOOTER_H = 56

/* ── Draw page footer with signature, name, URL, and page number ── */
function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  sigBmp: ImageBitmap | null,
  pageNum: number,
  totalPages: number,
) {
  const footerY = A4_H - FOOTER_H

  /* Separator line above footer */
  ctx.strokeStyle = "#e2e2e2"
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(PAGE_LEFT, footerY)
  ctx.lineTo(A4_W - PAGE_RIGHT, footerY)
  ctx.stroke()

  /* Signature image (left side) + name/title below */
  let nameX = PAGE_LEFT
  if (sigBmp) {
    const drawH = 22
    const drawW = (sigBmp.width / sigBmp.height) * drawH
    ctx.drawImage(sigBmp, PAGE_LEFT, footerY + 6, drawW, drawH)
  }

  /* Name and title below signature */
  ctx.font = "bold 8px Inter, system-ui, sans-serif"
  ctx.fillStyle = "#18191B"
  ctx.fillText(SIGNER_NAME, nameX, footerY + 38)

  ctx.font = "8px Inter, system-ui, sans-serif"
  ctx.fillStyle = "#6b7280"
  ctx.fillText(` – ${SIGNER_TITLE}`, nameX + ctx.measureText(SIGNER_NAME).width, footerY + 38)

  /* Page number centered */
  ctx.font = "8px Inter, system-ui, sans-serif"
  ctx.fillStyle = "#9ca3af"
  const pageText = `${pageNum} / ${totalPages}`
  const pw = ctx.measureText(pageText).width
  ctx.fillText(pageText, A4_W / 2 - pw / 2, footerY + 38)

  /* URL on the right side */
  ctx.fillStyle = "#9ca3af"
  ctx.fillText(
    TOS_URL,
    A4_W - PAGE_RIGHT - ctx.measureText(TOS_URL).width,
    footerY + 38,
  )
}

/* ── Draw a single content block and return new Y position ── */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: ContentBlock,
  y: number,
): number {
  switch (block.type) {
    case "title": {
      ctx.font = "bold 20px Inter, system-ui, sans-serif"
      ctx.fillStyle = "#18191B"
      ctx.fillText("Általános Szerződési Feltételek", PAGE_LEFT, y + 16)
      y += 28

      ctx.font = "10px Inter, system-ui, sans-serif"
      ctx.fillStyle = "#6b7280"
      ctx.fillText("Hatálybalépés: 2026.03.15.", PAGE_LEFT, y + 10)
      y += 16 + 16
      break
    }
    case "section-title": {
      ctx.font = sectionTitleFont
      ctx.fillStyle = "#18191B"
      ctx.fillText(block.text!, PAGE_LEFT, y + 14)
      y += 18 + 8
      break
    }
    case "item": {
      ctx.font = bodyFont
      ctx.fillStyle = "#374151"
      for (const line of block.lines!) {
        ctx.fillText(line, PAGE_LEFT, y + 11)
        y += lineHeight
      }
      y += itemGap
      break
    }
    case "gap": {
      y += sectionGap
      break
    }
  }
  return y
}

/* ── Distribute blocks across pages ── */
function paginateBlocks(blocks: ContentBlock[]): ContentBlock[][] {
  const letterheadH = LOGO_SIZE + 10 + 1 + 20 // ~59px
  const usableH = A4_H - PAGE_TOP - letterheadH - FOOTER_H

  const pages: ContentBlock[][] = [[]]
  let currentPageH = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (currentPageH + block.height <= usableH) {
      pages[pages.length - 1].push(block)
      currentPageH += block.height
    } else {
      /* Start a new page */
      pages.push([block])
      currentPageH = block.height
    }
  }

  return pages
}

/* ── Load the signature image as an ImageBitmap ── */
const SIGNATURE_URL =
  "https://github.com/user-attachments/assets/fcbee10a-8765-443c-962d-2558bcd6d26d"

async function loadSignature(): Promise<ImageBitmap | null> {
  /* Try loading from each source in order: remote PNG, local SVG fallback */
  const sources = [SIGNATURE_URL, "/signature.svg"]

  for (const src of sources) {
    try {
      const bmp = await new Promise<ImageBitmap | null>((resolve) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = async () => {
          const c = document.createElement("canvas")
          c.width = img.naturalWidth || 320
          c.height = img.naturalHeight || 100
          const cx = c.getContext("2d")!
          cx.drawImage(img, 0, 0, c.width, c.height)
          try {
            resolve(await createImageBitmap(c))
          } catch {
            resolve(null)
          }
        }
        img.onerror = () => resolve(null)
        img.src = src
      })
      if (bmp) return bmp
    } catch {
      /* try next source */
    }
  }

  console.error("Failed to load signature from any source")
  return null
}

/* ── Main: generate A4 pages and trigger downloads ── */
async function generateA4Pages() {
  /* Load assets */
  const logoResp = await fetch("/logo.png")
  const logoBlob = await logoResp.blob()
  const logoBmp = await createImageBitmap(logoBlob)
  const sigBmp = await loadSignature()

  /* Measure blocks using a temporary canvas */
  const tmp = document.createElement("canvas")
  tmp.width = A4_W
  const tmpCtx = tmp.getContext("2d")!
  const blocks = measureBlocks(tmpCtx)

  /* Paginate */
  const pages = paginateBlocks(blocks)

  /* Render and download each page */
  for (let p = 0; p < pages.length; p++) {
    const canvas = document.createElement("canvas")
    canvas.width = A4_W * DPR
    canvas.height = A4_H * DPR
    const ctx = canvas.getContext("2d")!
    ctx.scale(DPR, DPR)

    /* White background */
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, A4_W, A4_H)

    /* Letterhead */
    let y = drawLetterhead(ctx, logoBmp)

    /* Draw content blocks */
    for (const block of pages[p]) {
      y = drawBlock(ctx, block, y)
    }

    /* Footer with signature on every page */
    drawPageFooter(ctx, sigBmp, p + 1, pages.length)

    /* Download */
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error(`Failed to generate page ${p + 1}`)
          resolve()
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `Sycord_ASZF_${p + 1}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        /* Small delay between downloads so the browser handles them */
        setTimeout(resolve, 300)
      }, "image/png")
    })
  }
}

export default function TosDownloadButton() {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      await generateA4Pages()
    } finally {
      setDownloading(false)
    }
  }, [])

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
    >
      <Download className="w-3.5 h-3.5" />
      {downloading ? "Letöltés..." : "Letöltés képként (A4)"}
    </button>
  )
}
