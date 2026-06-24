import Link from "next/link"
import Image from "next/image"
import TosDownloadButton from "./tos-download-button"

export const metadata = {
  title: "Általános Szerződési Feltételek – Sycord",
  description: "Sycord általános szerződési feltételek és felhasználási szabályzat.",
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#18191B] flex flex-col items-center overflow-x-hidden font-sans">
      {/* Header */}
      <header className="w-full px-4 md:px-8 py-4 md:py-6 flex items-center justify-between z-20 sticky top-0 bg-[#18191B]/95 backdrop-blur-sm border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <Image src="/logo.png" alt="Sycord Logo" width={28} height={28} className="opacity-90" />
          <span className="text-base md:text-xl font-bold text-white tracking-tight">Sycord</span>
        </Link>
      </header>

      {/* Content */}
      <main className="w-full flex-1 flex flex-col items-center px-4 md:px-8 py-10 md:py-16">
        <article className="max-w-3xl w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <h1 className="text-2xl md:text-4xl font-bold text-white">Általános Szerződési Feltételek</h1>
            <TosDownloadButton />
          </div>
          <p className="text-[#8A8E91] text-xs mb-10">Hatálybalépés: 2026.03.15.</p>

          {/* 1 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">1. Bevezető Rendelkezések</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">1.1 Szolgáltató:</span> A Sycord platformot (a továbbiakban: &quot;Szolgáltatás&quot;) a Sycord üzemelteti. Kapcsolat: <a href="mailto:admin@sycord.com" className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">admin@sycord.com</a>.</li>
              <li><span className="text-white/70 font-medium">1.2 Tárgy:</span> A jelen Általános Szerződési Feltételek (ÁSZF) szabályozzák a Sycord AI-alapú weboldalkészítő platform használatát, beleértve a weboldal-szerkesztést, tárhelyszolgáltatást, mesterséges intelligencia alapú kódgenerálást, GitHub-integrációt és domain-kezelést.</li>
              <li><span className="text-white/70 font-medium">1.3 Elfogadás:</span> A Szolgáltatás használatával — ideértve a regisztrációt, bejelentkezést vagy bármely funkció igénybevételét — a Felhasználó elfogadja a jelen ÁSZF-et és az <Link href="/pap" className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">Adatvédelmi Irányelveket</Link>.</li>
              <li><span className="text-white/70 font-medium">1.4 Módosítás:</span> A Sycord fenntartja a jogot a jelen feltételek egyoldalú módosítására. A változásokról a felhasználók a platformon keresztül értesítést kapnak. A Szolgáltatás további használata a módosított feltételek elfogadásának minősül.</li>
              <li><span className="text-white/70 font-medium">1.5 Hatály:</span> A jelen ÁSZF 2026. március 15-től hatályos és visszavonásig érvényes.</li>
            </ul>
          </section>

          {/* 2 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">2. A Szolgáltatás Leírása</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">2.1 Weboldalkészítés:</span> A Sycord lehetőséget biztosít weboldalak létrehozására, szerkesztésére és közzétételére vizuális szerkesztő és AI-alapú kódgenerátor segítségével, kódolási ismeretek nélkül.</li>
              <li><span className="text-white/70 font-medium">2.2 AI Kódgenerálás:</span> A platform Google Gemini és DeepSeek mesterséges intelligencia modelleket használ HTML, CSS és TypeScript kód automatikus generálásához. A felhasználói promptok feldolgozásra kerülnek ezen külső AI szolgáltatók által.</li>
              <li><span className="text-white/70 font-medium">2.3 Tárhelyszolgáltatás:</span> Az elkészült weboldalak a Sycord infrastruktúráján kerülnek közzétételre, egyedi aldomain (*.sycord.com) vagy egyéni domain alatt.</li>
              <li><span className="text-white/70 font-medium">2.4 GitHub Integráció:</span> A weboldalak forráskódja GitHub repositorykba kerül telepítésre automatikus deployment folyamattal.</li>
              <li><span className="text-white/70 font-medium">2.5 Firebase Szinkronizáció:</span> A szerkesztési adatok valós időben szinkronizálódnak Firebase infrastruktúrán keresztül, biztosítva az azonnali frissítéseket.</li>
              <li><span className="text-white/70 font-medium">2.6 Tartalomszűrés:</span> A platform automatikus tartalommoderációt alkalmaz (szűrőrendszer) a nem megfelelő tartalmak kiszűrésére.</li>
            </ul>
          </section>

          {/* 3 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">3. Regisztráció és Fiókkezelés</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">3.1 Regisztráció:</span> A Szolgáltatás igénybevételéhez Google-fiókkal történő bejelentkezés szükséges (Google OAuth). A regisztráció során a Sycord hozzáfér a felhasználó nevéhez, e-mail címéhez és profilképéhez.</li>
              <li><span className="text-white/70 font-medium">3.2 Hitelesség:</span> A Felhasználó szavatolja, hogy a megadott adatok valósak és naprakészek. Hamis adatok megadása a fiók azonnali felfüggesztéséhez vezethet.</li>
              <li><span className="text-white/70 font-medium">3.3 Munkamenet:</span> A bejelentkezési munkamenetek JWT tokeneken alapulnak, 30 napos lejárattal. A Sycord verzióalapú munkamenet-érvénytelenítést alkalmaz az egyidejű munkamenetek megakadályozására.</li>
              <li><span className="text-white/70 font-medium">3.4 Fiókbiztonság:</span> A Felhasználó felelős a fiókjához tartozó Google-fiók biztonságáért. A Sycord nem vállal felelősséget illetéktelen hozzáférésből eredő károkért.</li>
              <li><span className="text-white/70 font-medium">3.5 Korhatár:</span> A Szolgáltatás kizárólag 16 éven felüli személyek számára érhető el. 16 év alatti felhasználó észlelése esetén a fiók azonnali törlésre kerül.</li>
            </ul>
          </section>

          {/* 4 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">4. Előfizetési Csomagok és Díjszabás</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">4.1 Ingyenes csomag (Sycord):</span> 1 weboldal, 1 GB tárhely, alap sablonok. Korlátozott funkciókészlet, AI-szerkesztő nem elérhető.</li>
              <li><span className="text-white/70 font-medium">4.2 Sycord+ ($9/hó):</span> Korlátlan weboldalak, 50 GB tárhely, AI Builder hozzáférés, 1 egyéni domain.</li>
              <li><span className="text-white/70 font-medium">4.3 Sycord Enterprise ($29/hó):</span> A Sycord+ csomag minden funkciója, 500 GB tárhely, korlátlan egyéni domain, prioritásos ügyfélszolgálat.</li>
              <li><span className="text-white/70 font-medium">4.4 Árváltoztatás:</span> A Sycord fenntartja az árak módosításának jogát. Az érvényes számlázási ciklus végéig a korábbi ár érvényes marad.</li>
              <li><span className="text-white/70 font-medium">4.5 Előfizetés kezelése:</span> Az előfizetési státusz az adminisztrációs rendszeren keresztül kerül kezelésre. A Felhasználó az előfizetés lemondását az ügyfélszolgálaton keresztül kérelmezheti.</li>
            </ul>
          </section>

          {/* 5 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">5. Felhasználói Tartalom és Szellemi Tulajdon</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">5.1 Felhasználói tartalom:</span> A Felhasználó által feltöltött vagy generált tartalmak (szövegek, képek, kódok, elrendezések) a Felhasználó tulajdonát képezik.</li>
              <li><span className="text-white/70 font-medium">5.2 Licenc a Sycord részére:</span> A tartalom feltöltésével a Felhasználó nem kizárólagos, visszavonható licencet ad a Sycordnak a tartalom tárolására, megjelenítésére és a Szolgáltatás működtetéséhez szükséges technikai feldolgozására.</li>
              <li><span className="text-white/70 font-medium">5.3 AI-generált tartalom:</span> Az AI által generált kód (HTML, CSS, TypeScript) a Felhasználó rendelkezésére áll. A Sycord nem vállal garanciát az AI-generált kód pontosságára, biztonságára vagy harmadik fél szellemi tulajdonjogának megsértésének hiányára.</li>
              <li><span className="text-white/70 font-medium">5.4 Platform szellemi tulajdona:</span> A Sycord márkanév, logó, forráskód, felhasználói felület és dizájn a Sycord kizárólagos szellemi tulajdonát képezik.</li>
              <li><span className="text-white/70 font-medium">5.5 Adminisztrátori hozzáférés:</span> <em className="text-yellow-500/80">Fontos:</em> A felhasználói tartalmak technikai okokból nem titkosított formában tárolódnak, és a rendszeradminisztrátorok számára hozzáférhetőek hibaelhárítás és karbantartás céljából.</li>
            </ul>
          </section>

          {/* 6 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">6. Elfogadható Használat és Tiltott Tevékenységek</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">6.1 Elfogadható használat:</span> A Szolgáltatás kizárólag jogszerű célokra, weboldalak létrehozására és közzétételére használható.</li>
              <li><span className="text-white/70 font-medium">6.2 Tiltott tartalmak:</span> Tilos bármilyen jogellenes, sértő, obszcén, gyűlöletkeltő, fenyegető, zaklatásnak minősülő, szerzői jogot sértő vagy mások személyiségi jogait sértő tartalom feltöltése vagy generálása.</li>
              <li><span className="text-white/70 font-medium">6.3 Technikai visszaélések:</span> Tilos a platform biztonsági rendszereinek megkerülése, API-k visszaélésszerű használata, automatizált tömeges lekérdezések végrehajtása, vagy a rendszer túlterhelésére irányuló bármely tevékenység.</li>
              <li><span className="text-white/70 font-medium">6.4 AI visszaélés:</span> Tilos az AI-szerkesztő használata rosszindulatú kód (malware, phishing oldalak, adatgyűjtő scriptek) generálására, vagy harmadik fél jogait sértő tartalom előállítására.</li>
              <li><span className="text-white/70 font-medium">6.5 Következmények:</span> A jelen szabályok megsértése a fiók azonnali felfüggesztéséhez vagy végleges törléséhez vezethet, a Sycord egyoldalú döntése alapján, előzetes értesítés nélkül.</li>
            </ul>
          </section>

          {/* 7 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">7. AI Szolgáltatások és Harmadik Felek</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">7.1 AI szolgáltatók:</span> A Sycord a Google Gemini (2.0 Flash / 3.1 Pro) és DeepSeek mesterséges intelligencia modelleket használja. A felhasználói promptok és projektadatok továbbításra kerülnek ezen szolgáltatók felé a kódgenerálás érdekében.</li>
              <li><span className="text-white/70 font-medium">7.2 Adatfelhasználás:</span> Az AI szolgáltatók felé továbbított adatok nem kerülnek felhasználásra modell-tanítási célokra (ez a beállítás explicit módon le van tiltva a rendszerben).</li>
              <li><span className="text-white/70 font-medium">7.3 Google Cloud Platform:</span> Az adatok a Google Cloud Platform és Firebase szerverein kerülnek tárolásra és feldolgozásra, az érvényes adatfeldolgozási megállapodásoknak (DPA) megfelelően.</li>
              <li><span className="text-white/70 font-medium">7.4 GitHub:</span> A weboldalak forráskódja a Sycord GitHub szervezetén belüli repositorykba kerül telepítésre. A GitHub saját felhasználási feltételei és adatvédelmi szabályzata külön alkalmazandó.</li>
              <li><span className="text-white/70 font-medium">7.5 Felelősség:</span> A Sycord nem vállal felelősséget a harmadik fél szolgáltatók (Google, GitHub, DeepSeek) rendszereinek kieséséért, adatvédelmi incidenseiért vagy szolgáltatás-változásaiért.</li>
            </ul>
          </section>

          {/* 8 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">8. Rendelkezésre Állás és Felelősségkorlátozás</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">8.1 Rendelkezésre állás:</span> A Sycord törekszik a Szolgáltatás folyamatos elérhetőségére, azonban nem garantál 100%-os üzemidőt. Karbantartási szünetek előfordulhatnak.</li>
              <li><span className="text-white/70 font-medium">8.2 &quot;Ahogy van&quot; állapot:</span> A Szolgáltatás &quot;ahogy van&quot; (&quot;as is&quot;) és &quot;ahogy elérhető&quot; (&quot;as available&quot;) alapon kerül nyújtásra, kifejezett vagy hallgatólagos garancia nélkül.</li>
              <li><span className="text-white/70 font-medium">8.3 AI pontosság:</span> Az AI által generált tartalom hibákat tartalmazhat. A Sycord nem garantálja a generált kód helyességét, biztonságát vagy harmadik fél jogainak megsértésének hiányát. A Felhasználó felelős a generált tartalom áttekintéséért és használatáért.</li>
              <li><span className="text-white/70 font-medium">8.4 Felelősségkorlátozás:</span> A Sycord maximális felelőssége nem haladhatja meg a Felhasználó által az utolsó 12 hónapban ténylegesen kifizetett előfizetési díjak összegét. Közvetett, következményi vagy különleges károkért a Sycord nem vállal felelősséget.</li>
              <li><span className="text-white/70 font-medium">8.5 Adatvesztés:</span> A Sycord nem vállal felelősséget a Felhasználó által feltöltött tartalmak elvesztéséért. A Felhasználó felelős a saját tartalmai rendszeres mentéséért.</li>
            </ul>
          </section>

          {/* 9 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">9. Fiók Felfüggesztése és Megszüntetése</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">9.1 Felhasználó általi megszüntetés:</span> A Felhasználó bármikor kérelmezheti fiókja törlését az <a href="mailto:admin@sycord.com" className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">admin@sycord.com</a> címen.</li>
              <li><span className="text-white/70 font-medium">9.2 Sycord általi felfüggesztés:</span> A Sycord jogosult a fiók azonnali felfüggesztésére vagy törlésére a jelen ÁSZF megsértése, jogellenes tevékenység vagy a platform integritását veszélyeztető magatartás esetén.</li>
              <li><span className="text-white/70 font-medium">9.3 Adattörlés:</span> A fiók megszüntetését követően a felhasználói adatok 30 napon belül törlésre kerülnek az éles adatbázisokból. A Firebase valós idejű adatok azonnal törlődnek. Biztonsági mentésekben az adatok további 60 napig maradhatnak.</li>
              <li><span className="text-white/70 font-medium">9.4 Közzétett weboldalak:</span> A fiók törlése után az összes közzétett weboldal és a hozzájuk tartozó domain-konfigurációk deaktiválásra kerülnek.</li>
            </ul>
          </section>

          {/* 10 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">10. Adatvédelem</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">10.1 Adatkezelés:</span> A személyes adatok kezelésére vonatkozó részletes szabályokat az <Link href="/pap" className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">Adatvédelmi Irányelvek</Link> tartalmazzák, amelyek a jelen ÁSZF elválaszthatatlan részét képezik.</li>
              <li><span className="text-white/70 font-medium">10.2 Gyűjtött adatok:</span> Google-fiókadatok (név, e-mail, profilkép), IP-cím, munkamenet-adatok, feltöltött tartalmak és AI-promptok.</li>
              <li><span className="text-white/70 font-medium">10.3 GDPR megfelelőség:</span> Az adatkezelés a GDPR (Általános Adatvédelmi Rendelet) 6. cikkében meghatározott jogalapoknak megfelelően történik.</li>
              <li><span className="text-white/70 font-medium">10.4 Felhasználói felelősség:</span> Amennyiben a Felhasználó a saját weboldalán látogatói adatokat gyűjt, a Felhasználó minősül adatkezelőnek, a Sycord pedig adatfeldolgozónak ezen adatok tekintetében. A Felhasználó köteles biztosítani a saját adatkezelésének jogszerűségét.</li>
            </ul>
          </section>

          {/* 11 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">11. Domain-kezelés és Tárhely</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">11.1 Aldomain:</span> Minden közzétett weboldal alapértelmezetten egy *.sycord.com aldomain alatt érhető el.</li>
              <li><span className="text-white/70 font-medium">11.2 Egyéni domain:</span> A Sycord+ és Enterprise csomagok esetén a Felhasználó egyéni domaint csatlakoztathat. A domain regisztrációs és megújítási díjai a Felhasználót terhelik.</li>
              <li><span className="text-white/70 font-medium">11.3 Tárhelykorlátok:</span> A tárhelyhasználat az előfizetési csomagnak megfelelő korlátokhoz kötött. A korlát túllépése a további feltöltések letiltásához vezethet.</li>
              <li><span className="text-white/70 font-medium">11.4 Aldomain fenntartás:</span> A Sycord fenntartja a jogot az aldomain visszavonására, amennyiben az sértő, megtévesztő vagy jogsértő tartalmat tartalmaz.</li>
            </ul>
          </section>

          {/* 12 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">12. Záró Rendelkezések</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">12.1 Irányadó jog:</span> A jelen ÁSZF-re a magyar jog az irányadó. Jogviták esetén a magyar bíróságok illetékesek.</li>
              <li><span className="text-white/70 font-medium">12.2 Részleges érvénytelenség:</span> Amennyiben a jelen ÁSZF bármely rendelkezése érvénytelennek vagy végrehajthatatlannak bizonyul, az nem érinti a többi rendelkezés érvényességét.</li>
              <li><span className="text-white/70 font-medium">12.3 Teljes megállapodás:</span> A jelen ÁSZF, az Adatvédelmi Irányelvekkel együtt, a Felek közötti teljes megállapodást képezi a Szolgáltatás használatával kapcsolatban.</li>
              <li><span className="text-white/70 font-medium">12.4 Kapcsolat:</span> Kérdések, észrevételek vagy panaszok esetén forduljon hozzánk: <a href="mailto:admin@sycord.com" className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">admin@sycord.com</a>.</li>
              <li><span className="text-white/70 font-medium">12.5 Verzió:</span> Jelen dokumentum verziószáma: 1.0 – Utolsó frissítés: 2026.03.15.</li>
            </ul>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-[#1F1F21]">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[#8A8E91] text-[11px]">© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <Link href="/" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">← Vissza a főoldalra</Link>
        </div>
      </footer>
    </div>
  )
}
