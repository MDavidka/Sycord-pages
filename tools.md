# AI Weboldalkészítő Agent - Eszköz Specifikáció (Tool Kit API)

Ez a dokumentum tartalmazza az AI weboldalkészítő agent által használható backend függvények (eszközök) pontos leírását, paramétereit és példáit.

---

## 1. Projekt és Fájlkezelő Eszközök

Ezek az alapvető eszközök a projekt struktúrájának feltérképezésére és a forráskód módosítására szolgálnak.

### list_files
Megnézi, milyen fájlok és mappák találhatók a megadott útvonalon.
* **Paraméterek:**
    * `path` (string): A vizsgálandó mappa relatív útvonala.
* **Példa hívás:**
    ```json
    {
      "path": "src"
    }
    ```

### read_file
Beolvassa egy konkrét fájl teljes tartalmát.
* **Paraméterek:**
    * `path` (string): A beolvasandó fájl útvonala.
* **Példa hívás:**
    ```json
    {
      "path": "src/App.jsx"
    }
    ```

### write_file
Létrehoz egy új fájlt, vagy teljesen felülír egy már meglévőt a megadott tartalommal.
* **Paraméterek:**
    * `path` (string): A célfájl útvonala.
    * `content` (string): A fájl teljes új tartalma.
* **Példa hívás:**
    ```json
    {
      "path": "src/App.jsx",
      "content": "import React from 'react';\n\nexport default function App() {\n  return <h1>Hello World</h1>;\n}"
    }
    ```

### edit_file
Biztonságos, célzott módosítást hajt végre a fájlon belül az `old_text` pontos cseréjével `new_text`-re.
* **Paraméterek:**
    * `path` (string): A módosítandó fájl útvonala.
    * `old_text` (string): A lecserélendő, pontos kódrészlet.
    * `new_text` (string): Az új kódrészlet, ami a régi helyére lép.
* **Példa hívás:**
    ```json
    {
      "path": "src/App.jsx",
      "old_text": "<h1>Hello World</h1>",
      "new_text": "<h1>Welcome to my website</h1>"
    }
    ```

### delete_file
Véglegesen töröl egy fájlt a projektből.
* **Paraméterek:**
    * `path` (string): A törlendő fájl útvonala.
* **Példa hívás:**
    ```json
    {
      "path": "src/oldComponent.jsx"
    }
    ```

### create_folder
Létrehoz egy új mappát (szükség esetén a szülőmappákkal együtt).
* **Paraméterek:**
    * `path` (string): A létrehozandó mappa útvonala.
* **Példa hívás:**
    ```json
    {
      "path": "src/components"
    }
    ```

### move_file
Áthelyez egy fájlt egy új helyre.
* **Paraméterek:**
    * `from` (string): A fájl jelenlegi útvonala.
    * `to` (string): A fájl új útvonala.
* **Példa hívás:**
    ```json
    {
      "from": "src/Button.jsx",
      "to": "src/components/Button.jsx"
    }
    ```

### rename_file
Átnevez egy meglévő fájlt.
* **Paraméterek:**
    * `old_path` (string): A fájl jelenlegi útvonala és neve.
    * `new_path` (string): A fájl új útvonala és neve.
* **Példa hívás:**
    ```json
    {
      "old_path": "src/Hero.jsx",
      "new_path": "src/HeroSection.jsx"
    }
    ```

---

## 2. Tömeges (Bulk) Fájlműveletek

Token- és költséghatékonysági szempontból optimalizált eszközök, amelyek egyetlen hívással több fájlt kezelnek.

### write_files
Több fájlt hoz létre vagy ír felül egyetlen tranzakcióban. Ideális komplex komponensek vagy komplett landing page-ek legenerálásához.
* **Paraméterek:**
    * `files` (array): Fájlobjektumok listája, ahol minden objektum tartalmaz egy `path` és egy `content` mezőt.
* **Példa hívás:**
    ```json
    {
      "files": [
        {
          "path": "src/App.jsx",
          "content": "import './App.css';\nexport default function App() { return <div className='main'>SaaS</div>; }"
        },
        {
          "path": "src/App.css",
          "content": ".main { background: #000; color: #fff; }"
        }
      ]
    }
    ```

### read_files
Több megadott fájl tartalmát olvassa be egyszerre, csökkentve a hálózati körök számát.
* **Paraméterek:**
    * `paths` (array of strings): A beolvasandó fájlok útvonalainak listája.
* **Példa hívás:**
    ```json
    {
      "paths": [
        "package.json",
        "tailwind.config.js",
        "src/main.jsx"
      ]
    }
    ```

### apply_patch
Összetett, Git-szerű vagy Unified Diff alapú patch módosításokat alkalmaz a kódbázison.
* **Paraméterek:**
    * `patch` (string): A végrehajtandó patch standard formátumú leírása.
* **Példa hívás:**
    ```json
    {
      "patch": "Modify src/App.jsx to include the Google Analytics hook dynamically."
    }
    ```

---

## 3. Terminál és Csomagkezelés

Olyan parancssori műveletek, amelyek segítségével az Agent képes függőségeket kezelni, tesztelni és buildelni az oldalt.

### run_command
Lefuttat egy tetszőleges parancsot a projekt gyökérmappájában.
* **Paraméterek:**
    * `command` (string): A terminálban futtatandó parancs.
* **Példa hívás:**
    ```json
    {
      "command": "npm install framer-motion"
    }
    ```

### install_package
Kontrollált és biztonságos módon telepít egy specifikus npm csomagot a projekthez.
* **Paraméterek:**
    * `package_name` (string): A telepítendő csomag pontos neve.
* **Példa hívás:**
    ```json
    {
      "package_name": "lucide-react"
    }
    ```

### get_package_info
Lekéri a projekt aktuális `package.json` fájljának legfontosabb adatait (keretrendszer, verziók, függőségek listája).
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

---

## 4. Projekt Felismerő és Elemző Eszközök

Segítenek az Agentnek feltérképezni és megérteni a kapott munkakörnyezetet anélkül, hogy feleslegesen nagy fájlokat olvasna be.

### detect_framework
Automatikusan azonosítja a projektben használt keretrendszert, build eszközt és CSS könyvtárat.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### get_project_structure
Visszaadja a projekt teljes fastruktúráját (mappák és fájlok neveit) egy könnyen emészthető fastruktúrában.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### summarize_project
Egy gyors, szöveges összefoglalót ad a projekt aktuális architektúrájáról és állapotáról a belső memória frissítéséhez.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

---

## 5. Előnézet és Böngésző (Browser) Eszközök

Biztosítják, hogy az Agent vizuálisan és futási időben is ellenőrizni tudja az elkészült weboldalt.

### start_preview
Elindítja a helyi fejlesztői szervert (pl. `npm run dev`), és létrehozza a kapcsolatot az előnézethez.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### get_preview_url
Lekéri a jelenleg futó fejlesztői szerver élő, belső URL címét.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### take_screenshot
A megadott URL-en futó weboldalról készít egy képernyőképet, amit az Agent vizuálisan kielemezhet.
* **Paraméterek:**
    * `url` (string): Az előnézeti URL címe.
* **Példa hívás:**
    ```json
    {
      "url": "http://localhost:5173"
    }
    ```

### inspect_page
Kigyűjti a megadott oldal legfontosabb HTML elemeit (gombok, címsorok, linkek), hogy az Agent lássa az oldal DOM struktúráját.
* **Paraméterek:**
    * `url` (string): A vizsgálandó oldal címe.
* **Példa hívás:**
    ```json
    {
      "url": "http://localhost:5173"
    }
    ```

### get_console_logs
Lekéri a böngésző konzoljának (Console) hibaüzeneteit és logjait, ami kritikus fontosságú a runtime (futás közbeni) hibák javításához.
* **Paraméterek:**
    * `url` (string): A vizsgálandó oldal címe.
* **Példa hívás:**
    ```json
    {
      "url": "http://localhost:5173"
    }
    ```

---

## 6. Build, Teszt és Minőségellenőrzés

Ezek az eszközök validálják, hogy a kód nemcsak vizuálisan jó, de szerkezetileg és szintaktikailag is hibátlan.

### run_build
Lefuttatja a projekt production build folyamatát (`npm run build`), hogy kiderüljön, vannak-e rejtett fordítási hibák.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### run_lint
Lefuttatja a kódminőség-ellenőrzőt (Linter), hogy kiszűrje a formázási és potenciális szintaktikai hibákat.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### run_tests
Elindítja a projektben definiált automatizált egység- vagy integrációs teszteket.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### check_types
Lefuttatja a TypeScript típusellenőrzést (pl. `tsc --noEmit`), amennyiben a projekt támogatja azt.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### analyze_error
Egy kapott hibaüzenet (pl. build vagy konzol hiba) alapján elemzést és javítási javaslatot generál.
* **Paraméterek:**
    * `error_text` (string): A nyers hibaüzenet szövege.
* **Példa hívás:**
    ```json
    {
      "error_text": "Module not found: Can't resolve './Button' in 'src/App.jsx'"
    }
    ```

---

## 7. Memória és Cache Kezelés

Lehetővé teszik az Agent számára, hogy a különböző prompt-körök és felhasználói interakciók között is megőrizze a kontextust és a fontos információkat.

### memory_get
Lekér egy korábban elmentett értéket vagy beállítást a memóriából kulcs alapján.
* **Paraméterek:**
    * `key` (string): A keresett memória-kulcs egyedi azonosítója.
* **Példa hívás:**
    ```json
    {
      "key": "project:123:summary"
    }
    ```

### memory_set
Elment egy információt vagy preferenciát a hosszú távú memóriába.
* **Paraméterek:**
    * `key` (string): A kulcs, ami alá az adat mentésre kerül.
    * `value` (any): A mentendő érték (szöveg, objektum, stb.).
* **Példa hívás:**
    ```json
    {
      "key": "project:123:framework",
      "value": "React + Vite + Tailwind"
    }
    ```

### memory_search
Szemantikus (jelentés alapú) keresést végez a régi emlékek és felhasználói preferenciák között.
* **Paraméterek:**
    * `query` (string): A keresett téma vagy kifejezés.
* **Példa hívás:**
    ```json
    {
      "query": "user design preferences"
    }
    ```

### memory_delete
Töröl egy bejegyzést a memóriából.
* **Paraméterek:**
    * `key` (string): A törlendő elem kulcsa.
* **Példa hívás:**
    ```json
    {
      "key": "project:123:temp_notes"
    }
    ```

### cache_file
A gyorsabb elérés érdekében és a lemezműveletek csökkentésére gyorsítótárba helyezi a fájl tartalmát és annak hash-ét.
* **Paraméterek:**
    * `path` (string): A fájl útvonala.
    * `content_hash` (string): A tartalom MD5 vagy SHA-256 lenyomata.
    * `content` (string): A fájl tényleges tartalma.
* **Példa hívás:**
    ```json
    {
      "path": "package.json",
      "content_hash": "a1b2c3d4...",
      "content": "{...}"
    }
    ```

### get_cached_file
Lekéri a fájl tartalmát a gyorsítótárból (cache), ha az nem változott a lemezen.
* **Paraméterek:**
    * `path` (string): A keresett fájl útvonala.
* **Példa hívás:**
    ```json
    {
      "path": "package.json"
    }
    ```

---

## 8. Design és UI Eszközök

Kreatív asszisztens funkciók, amelyek segítenek egységes arculatot adni az oldalnak.

### generate_color_palette
A megadott stílus vagy leírás alapján legenerál egy harmonikus, akadálymentes (accessible) színpalettát hex kódokkal.
* **Paraméterek:**
    * `style` (string): A design stílusa (pl. "minimal dark SaaS").
* **Példa hívás:**
    ```json
    {
      "style": "modern dark SaaS landing page"
    }
    ```

### generate_design_system
Létrehoz egy teljes design rendszert (betűméretek, térközök, kerekítések, árnyékok, gomb stílusok) a márka információi alapján.
* **Paraméterek:**
    * `brand_info` (string): A márka küldetése, hangvétele, célközönsége.
* **Példa hívás:**
    ```json
    {
      "brand_info": "Eco-friendly startup focusing on sustainable logistics."
    }
    ```

### get_font_recommendations
Az oldal hangulatához leginkább passzoló Google Fonts vagy rendszerszintű betűtípus-párosításokat ajánl.
* **Paraméterek:**
    * `style` (string): A weboldal stíluskategóriája.
* **Példa hívás:**
    ```json
    {
      "style": "luxury fashion website"
    }
    ```

### get_icon_suggestions
Meghatározott szekciókhoz vagy funkciókhoz (pl. "features", "contact") releváns ikon neveket javasol (pl. Lucide / FontAwesome készletekből).
* **Paraméterek:**
    * `section` (string): A komponens vagy funkció leírása.
* **Példa hívás:**
    ```json
    {
      "section": "features_analytics_dashboard"
    }
    ```

---

## 9. Média és Asset Eszközök

A weboldal vizuális tartalmának (képek, logók, illusztrációk) kezelésére szolgáló API-k.

### upload_asset
A felhasználó által beküldött vagy helyi médiatartalmat menti el a projekt `assets` vagy `public` mappájába.
* **Paraméterek:**
    * `file` (string/binary): A fájl nyers adatai vagy elérési útvonala.
* **Példa hívás:**
    ```json
    {
      "file": "path/to/user_uploaded_logo.png"
    }
    ```

### list_assets
Kilistázza a projektben már elérhető és felhasználható képeket, vektorokat és logókat.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### get_asset_url
Visszaadja egy adott belső asset relatív vagy abszolút URL útvonalát, amit közvetlenül be lehet illeszteni az `<img>` tag `src` attribútumába.
* **Paraméterek:**
    * `asset_id` (string): Az asset egyedi azonosítója vagy neve.
* **Példa hívás:**
    ```json
    {
      "asset_id": "hero-bg.png"
    }
    ```

### generate_image
Külső AI képgeneráló (pl. DALL-E, Midjourney API) segítségével képet készít a megadott prompt alapján a weboldalhoz.
* **Paraméterek:**
    * `prompt` (string): A kép részletes leírása és stílusa.
* **Példa hívás:**
    ```json
    {
      "prompt": "modern hero image for AI SaaS dashboard, dark purple gradient, isometric view"
    }
    ```

### optimize_image
Közvetlenül optimalizálja (tömöríti, átméretezi, webp formátumba alakítja) a megadott képet a gyorsabb oldalbetöltés érdekében.
* **Paraméterek:**
    * `path` (string): Az optimalizálandó kép útvonala.
* **Példa hívás:**
    ```json
    {
      "path": "public/assets/hero-bg.png"
    }
    ```

---

## 10. Külső Adatok és Keresés

Lehetővé teszik az Agent számára, hogy külső információkat gyűjtsön inspiráció vagy tényadatok szerzése céljából.

### web_search
Internetes keresést indít a legfrissebb trendek, fejlesztői dokumentációk vagy kódminták felkutatására.
* **Paraméterek:**
    * `query` (string): A keresőkifejezés.
* **Példa hívás:**
    ```json
    {
      "query": "latest landing page design trends 2026"
    }
    ```

### fetch_url
Lekéri egy külső URL nyers forráskódját vagy JSON adatát elemzésre.
* **Paraméterek:**
    * `url` (string): A lekérni kívánt weboldal címe.
* **Példa hívás:**
    ```json
    {
      "url": "[https://example.com/api/data](https://example.com/api/data)"
    }
    ```

### scrape_website
Szemantikus elemzést végez egy külső weboldalon: kigyűjti a főbb színeket, betűtípusokat, címsorokat és struktúrát inspirációs célból.
* **Paraméterek:**
    * `url` (string): A vizsgálandó weboldal címe.
* **Példa hívás:**
    ```json
    {
      "url": "[https://competitor-awesome-ui.com](https://competitor-awesome-ui.com)"
    }
    ```

---

## 11. Verziókezelés és Mentési Pontok (Git-szerű működés)

Biztosítékok arra az esetre, ha az Agent hibás kódot generálna, így bármikor vissza lehet állni egy korábbi stabil állapotra.

### create_checkpoint
Létrehoz egy lokális mentési pontot a projekt aktuális állapotáról (egyfajta belső commit).
* **Paraméterek:**
    * `message` (string): A mentési pont leírása (mi történt közvetlenül előtte).
* **Példa hívás:**
    ```json
    {
      "message": "Before redesigning homepage and adding framer-motion"
    }
    ```

### restore_checkpoint
Visszaállítja a projektet egy korábban elmentett állapotra, törölve az azóta történt hibás módosításokat.
* **Paraméterek:**
    * `checkpoint_id` (string): A visszaállítandó mentési pont azonosítója.
* **Példa hívás:**
    ```json
    {
      "checkpoint_id": "cp_20260605_1850"
    }
    ```

### get_diff
Megmutatja a legutóbbi mentési pont vagy az eredeti állapot óta végrehajtott összes módosítást fájlonként.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### commit_changes
Véglegesíti a módosításokat a projekt valódi Git verziókezelőjében.
* **Paraméterek:**
    * `message` (string): A Git commit üzenet.
* **Példa hívás:**
    ```json
    {
      "message": "feat: Create modern landing page with responsive navbar"
    }
    ```

---

## 12. Felhasználói Interakciós Eszközök

Biztosítják a kétirányú kommunikációt az Agent és a felhasználó között olyan esetekben, amikor az Agent nem tud vagy nem akar önálló döntést hozni.

### ask_user
Kérdést tesz fel a felhasználónak, ha tisztázni kell a design irányát, a szövegezést vagy a funkcionalitást. Blokkolja a futást a válaszig.
* **Paraméterek:**
    * `question` (string): A felhasználónak szánt kérdés szövege.
* **Példa hívás:**
    ```json
    {
      "question": "Milyen stílust szeretnél a landing page-hez: modern sötét, letisztult minimál, vagy prémium luxus?"
    }
    ```

---

## 13. Adatbázis és Backend Eszközök

Full-stack alkalmazások fejlesztése esetén használható funkciók az adatmodell és az API-k felépítésére.

### create_database_table
Létrehoz egy új táblát vagy adatmodellt a backend adatbázisában a megadott séma alapján.
* **Paraméterek:**
    * `schema` (object): A tábla oszlopainak és típusainak definíciója.
* **Példa hívás:**
    ```json
    {
      "table_name": "leads",
      "columns": {
        "id": "SERIAL PRIMARY KEY",
        "email": "VARCHAR(255) NOT NULL",
        "created_at": "TIMESTAMP DEFAULT NOW()"
      }
    }
    ```

### run_database_query
Végrehajt egy specifikus SQL vagy NoSQL lekérdezést az adatbázison ellenőrzés vagy tesztelés céljából.
* **Paraméterek:**
    * `query` (string): A futtatandó adatbázis parancs.
* **Példa hívás:**
    ```json
    {
      "query": "SELECT * FROM leads LIMIT 5;"
    }
    ```

### get_database_schema
Lekéri az adatbázis jelenlegi teljes felépítését (táblák, kapcsolatok, indexek).
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### create_api_route
Létrehoz egy új backend API végpontot (endpoint) a megadott HTTP metódussal és logikával.
* **Paraméterek:**
    * `path` (string): Az API útvonala.
    * `method` (string): HTTP metódus (GET, POST, PUT, DELETE).
    * `code` (string): A végpont lefutó kódja.
* **Példa hívás:**
    ```json
    {
      "path": "/api/contact",
      "method": "POST",
      "code": "const { email } = req.body; await db.save({ email }); res.status(200).json({ success: true });"
    }
    ```

---

## 14. SEO és Teljesítmény (Performance) Eszközök

Segítenek optimalizálni az elkészült weboldalt a keresőmotorok és a gyors betöltődés követelményei szerint.

### analyze_seo
Végignézi az oldalt keresőoptimalizálási szempontból (meta tagek, címsorok hierarchiája, képek alt attribútumai).
* **Paraméterek:**
    * `url` (string): A vizsgálandó (helyi vagy éles) URL.
* **Példa hívás:**
    ```json
    {
      "url": "http://localhost:5173"
    }
    ```

### generate_meta_tags
A megadott oldal információi (leírás, kulcsszavak) alapján legenerálja a pontos HTML meta és OpenGraph tageket.
* **Paraméterek:**
    * `page_info` (object): Az oldal címe és rövid leírása.
* **Példa hívás:**
    ```json
    {
      "page_info": {
        "title": "AI Website Builder - Create Sites in Seconds",
        "description": "The ultimate autonomous agent that builds, tests and launches your next SaaS website automatically."
      }
    }
    ```

### run_lighthouse
Lefuttat egy Google Lighthouse auditot (Performance, Accessibility, Best Practices, SEO), és visszaadja a pontszámokat valamint a javítandó pontokat.
* **Paraméterek:**
    * `url` (string): A vizsgálandó weboldal címe.
* **Példa hívás:**
    ```json
    {
      "url": "http://localhost:5173"
    }
    ```

### check_accessibility
Specifikus akadálymentességi (WCAG) tesztet futtat (pl. színkontraszt arányok, képernyőolvasó-barát felépítés, billentyűzet-navigáció).
* **Paraméterek:**
    * `url` (string): A vizsgálandó weboldal címe.
* **Példa hívás:**
    ```json
    {
      "url": "http://localhost:5173"
    }
    ```

---

## 15. Komponens és Template Eszközök

Kész sablonok és komponens-gyűjtemények elérését biztosító eszközök a fejlesztés felgyorsításához.

### list_templates
Kilistázza a rendszerben elérhető előre megírt sablonokat kategóriák szerint.
* **Paraméterek:**
    * `category` (string): A sablon kategóriája (pl. "landing-page", "pricing").
* **Példa hívás:**
    ```json
    {
      "category": "landing-page"
    }
    ```

### get_template
Beolvassa egy konkrét előre definiált sablon kódját.
* **Paraméterek:**
    * `template_id` (string): A sablon egyedi azonosítója.
* **Példa hívás:**
    ```json
    {
      "template_id": "saas-hero-section-01"
    }
    ```

### insert_component
Beilleszt egy meglévő komponenst egy megadott célfájl megfelelő helyére.
* **Paraméterek:**
    * `component_name` (string): A beillesztendő komponens neve.
    * `target_file` (string): A fájl, ahova a komponenst be kell importálni és ágyazni.
* **Példa hívás:**
    ```json
    {
      "component_name": "HeroSection",
      "target_file": "src/App.jsx"
    }
    ```

### generate_component
Egyedi leírás alapján, nulláról generál egy új, elszigetelt UI komponenst a kért stílusban és logikával.
* **Paraméterek:**
    * `description` (string): A komponens funkciója és kinézete.
* **Példa hívás:**
    ```json
    {
      "description": "pricing section with 3 cards, yearly/monthly toggle switch and modern neon borders"
    }
    ```

---

## 16. Belső Állapotkezelő Eszközök (State Logging)

Segítségükkel az Agent nyomon tudja követni a saját komplex, többlépcsős munkafolyamatát, és egy esetleges hiba után onnan folytathatja a munkát, ahol abbahagyta.

### get_task_state
Lekéri a jelenlegi összetett feladat (task) globális állapotát, lépéseit és a folyamat előrehaladását.
* **Paraméterek:** Nincsenek.
* **Példa hívás:**
    ```json
    {}
    ```

### set_task_state
Frissíti az Agent belső állapotgépét (State Machine), rögzítve az elvégzett és a hátralévő feladatokat.
* **Paraméterek:**
    * `state` (object): Az új állapottérkép objektuma.
* **Példa hívás:**
    ```json
    {
      "state": {
        "current_step": "building homepage",
        "completed": ["project scan", "design system configuration"],
        "next": ["write files", "run build validation"]
      }
    }
    ```

### log_action
Eseménynaplót (Audit Log) vezet az Agent által végrehajtott legfontosabb lépésekről a felhasználói felület (UI) és a hibakeresés felé.
* **Paraméterek:**
    * `action` (string): Az elvégzett művelet rövid leírása.
* **Példa hívás:**
    ```json
    {
      "action": "Successfully updated global layout grid in src/App.jsx"
    }
    ```
