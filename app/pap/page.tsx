import Link from "next/link"
import Image from "next/image"

export const metadata = {
  title: "Adatvédelmi Irányelvek – Sycord",
  description: "Sycord adatvédelmi és adatkezelési szabályzat.",
}

export default function PrivacyPolicyPage() {
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
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">Adatvédelmi Irányelvek</h1>
          <p className="text-[#8A8E91] text-xs mb-10">Hatálybalépés: 2026.03.14.</p>

          {/* 1 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">1. Preambulum és Alkalmazhatóság</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">1.1 Célkitűzés:</span> Transzparens adatkezelés a weboldalkészítő eszközök használata során, összhangban a GDPR és helyi jogszabályokkal.</li>
              <li><span className="text-white/70 font-medium">1.2 Személyi hatály:</span> Vonatkozik a regisztrált felhasználókra, weboldal-látogatókra és az ügyfélszolgálati megkeresésekre.</li>
              <li><span className="text-white/70 font-medium">1.3 Adatkezelői minőség:</span> A Sycord szolgáltatóként lép fel, de a felhasználók által készített oldalak látogatói tekintetében a Felhasználó az adatkezelő, a Szoftver pedig az adatfeldolgozó.</li>
              <li><span className="text-white/70 font-medium">1.4 Tárgyi hatály:</span> AI szerkesztő, tárhely, domain-regisztráció és fizetési tranzakciók.</li>
              <li><span className="text-white/70 font-medium">1.5 Hatálybalépés:</span> 2026.03.14. A módosítás jogát a platform fenntartja (értesítés mellett).</li>
            </ul>
          </section>

          {/* 2 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">2. Adatosztályozás és Technikai Háttér</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">2.1 Azonosítás:</span> Google Login adatok (egyedi azonosító, e-mail, profilkép), név és profiladatok.</li>
              <li><span className="text-white/70 font-medium">2.2 Hálózati adatok:</span> IP-cím naplózás (biztonság, nyelvválasztás) és elengedhetetlen munkamenet-sütik (Cookies).</li>
              <li><span className="text-white/70 font-medium">2.3 Firebase infrastruktúra:</span> Valós idejű adatok tárolása, szinkronizálása és felhasználói interakciók kezelése.</li>
              <li><span className="text-white/70 font-medium">2.4 Szerkesztési tartalom:</span> Feltöltött szövegek, képek, elrendezések. <em className="text-yellow-500/80">Fontos:</em> Ezek az adatok rendszeradminisztrátorok számára technikai okokból nem titkosított formában hozzáférhetőek.</li>
            </ul>
          </section>

          {/* 3 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">3. Az Adatkezelés Jogalapjai (GDPR 6. cikk)</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">3.1 Szerződés teljesítése:</span> Fiókkezelés, Google Login, weboldal-tárolás és a Firebase valós idejű kapcsolata.</li>
              <li><span className="text-white/70 font-medium">3.2 Jogos érdek:</span> Hálózatbiztonság (IP-cím), bot-támadások megelőzése és az adminisztrátori hibaelhárítás (debugging).</li>
              <li><span className="text-white/70 font-medium">3.3 Hozzájárulás:</span> Marketing és analitikai sütik használata.</li>
              <li><span className="text-white/70 font-medium">3.4 Jogi kötelezettség:</span> Hatósági megkeresések, adózási és számviteli előírások teljesítése.</li>
            </ul>
          </section>

          {/* 4 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">4. Adattovábbítás és Harmadik Felek</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">4.1 Infrastruktúra:</span> Adattovábbítás a Google Cloud Platform és Firebase szervereire (szigorú DPA szerződés mellett).</li>
              <li><span className="text-white/70 font-medium">4.2 Hitelesítés:</span> Technikai azonosítók visszaküldése a Google rendszereibe a biztonságos belépéshez.</li>
              <li><span className="text-white/70 font-medium">4.3 Értékesítési tilalom:</span> A Sycord nem értékesíti a felhasználói adatokat harmadik félnek.</li>
              <li><span className="text-white/70 font-medium">4.4 Hatósági adatszolgáltatás:</span> Csak bírósági végzésre vagy hivatalos idézésre történik adattovábbítás.</li>
            </ul>
          </section>

          {/* 5 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">5. Felhasználói Jogok és Érvényesítés</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">5.1 Jogkörök:</span> Hozzáférés (másolat kérése), helyesbítés, törlés (&quot;elfeledtetés&quot;), adathordozhatóság és tiltakozás.</li>
              <li><span className="text-white/70 font-medium">5.2 Törlés következményei:</span> A törlés után a nem titkosított adatok és konfigurációk nem állíthatóak vissza.</li>
              <li><span className="text-white/70 font-medium">5.3 Korlátozás:</span> Az IP-naplózás elleni tiltakozás a szolgáltatás felfüggesztésével járhat.</li>
            </ul>
          </section>

          {/* 6 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">6. Adatmegőrzési és Törlési Protokollok</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">6.1 Aktív adatok:</span> A fiók fennállásáig tárolódnak.</li>
              <li><span className="text-white/70 font-medium">6.2 Törlési idő:</span> Kezdeményezés után 30 napon belül törlődnek az éles adatbázisokból; a Firebase adatok azonnal törlésre kerülnek.</li>
              <li><span className="text-white/70 font-medium">6.3 Naplók:</span> IP-címek megőrzése 90 napig.</li>
              <li><span className="text-white/70 font-medium">6.4 Backups:</span> Biztonsági mentésekben az adatok további 60 napig maradhatnak (csak kritikus helyreállításra).</li>
            </ul>
          </section>

          {/* 7 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">7. Speciális Területek (MI és Védelem)</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">7.1 Mesterséges Intelligencia:</span> A promptok továbbításra kerülnek a Gemini felé. Alapesetben nincs modell-tanítás a felhasználói adatokon. Az AI tartalom is adminisztrátori felügyelet alatt áll.</li>
              <li><span className="text-white/70 font-medium">7.2 Gyermekvédelem:</span> 16 év alattiak nem használhatják. Észlelés esetén azonnali fióktörlés történik.</li>
              <li><span className="text-white/70 font-medium">7.3 DNT (Do Not Track):</span> Nincs automatikus támogatás a szabvány hiánya miatt, helyette a sütikezelő használható.</li>
            </ul>
          </section>

          {/* 8 */}
          <section className="mb-10">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">8. Adminisztratív Adatok</h2>
            <ul className="space-y-3 text-sm text-[#c0c2c5] leading-relaxed">
              <li><span className="text-white/70 font-medium">8.1 Adatkezelő:</span> Sycord</li>
              <li><span className="text-white/70 font-medium">8.2 Kapcsolattartás:</span> <a href="mailto:admin@sycord.com" className="text-white underline underline-offset-2 hover:text-white/80 transition-colors">admin@sycord.com</a></li>
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
