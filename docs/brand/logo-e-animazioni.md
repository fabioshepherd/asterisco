# Logo e animazioni — piano per la 1.0

Fetta di pianificazione del 2026-11-19 e 2026-11-20, ramo `brand/logo-plan`. Qui non c'è
codice di prodotto: icone, `src/` e `src-tauri/` restano come sono. L'implementazione è
descritta in [Fette di implementazione](#fette-di-implementazione).

> **Aggiornamento alla pubblicazione (2026-11-20).** Il piano è stato eseguito: segno e
> icone (PR #18), pannello About e `AppMark` (PR #19), animazioni fluide A1–A4 (PR #20). I
> numeri di PR e i nomi dei rami sono quelli del repository precedente, oggi archivio
> privato. In `docs/brand/concept/` restano solo i concept del giro per Asterisco; i concept
> respinti per il nome precedente sono nell'archivio.

**Stato in breve.** Il nome definitivo è **Asterisco** (2026-11-20, PR #15, `docs/naming.md`).
Il segno è scelto: **asterisco a cinque gocce, bianco su tessera nera** (2026-11-20; file in
`docs/brand/asterisco-*.svg`; storia in [Concept per Asterisco](#concept-per-asterisco)). Il resto del piano non cambia:
- il brief del segno;
- dove compare il logo;
- la tecnica di animazione;
- i momenti animati e le eccezioni a `DESIGN.md` già approvate;
- i testi;
- le fette di implementazione.

I concept per «Seppia» sono respinti; i loro file sono rimasti nell'archivio.

## Decisioni del proprietario

| Data | Decisione |
|---|---|
| 2026-11-19 | Procedere subito sul nome provvisorio «Seppia», senza aspettare il nome definitivo. |
| 2026-11-19 | Primo giro di concept respinto (seppia, goccia, «s» con punto, osso di seppia). Il proprietario vuole la seppia, ma non in quelle forme. |
| 2026-11-19 | Secondo giro superato (seppia di profilo e dall'alto). Il proprietario chiede una seppia vista di fronte, «filled e spessa», sul modello di un logo d'archivio (usato solo come direzione). |
| 2026-11-19 | Terzo giro superato: chiede la stessa seppia «più morbida e stilizzata». |
| 2026-11-19 | Quarto giro superato: «ancora troppo definito», il logo deve essere **monocolore**. |
| 2026-11-19 | Quinto giro: indica come direzione la sola sagoma senza occhi (T) e chiede altre varianti. |
| 2026-11-20 | **Varianti di T respinte, e con loro tutti i concept.** Il proprietario cambierà il nome: «Seppia» non gli sembra identificativo del programma. Il segno si rifà dopo il nome nuovo. |
| 2026-11-20 | Chiudere in questa fetta la parte che non dipende dal nome, con PR in bozza. |
| 2026-11-20 | **Pannello About nell'app, uguale su macOS, Windows e Linux.** Su macOS sostituisce quello nativo (che non si può animare); su Windows e Linux oggi non esiste. |
| 2026-11-20 | **Nome definitivo: Asterisco** (PR #15 unita su `main`, `f57247b`). Si riprende la fetta 0: nuovo giro di concept, asterisco pieno con le punte tonde più varianti che suggeriscono una pagina. |
| 2026-11-20 | **Segno scelto: asterisco a cinque gocce** (concept 2). Il proprietario chiede se somiglia troppo al marchio di Claude: sì, per forma radiale e colore arancio. Decisione: tenere le cinque gocce e **cambiare colore** per distinguerlo. Colore scelto nella riga sotto. |
| 2026-11-20 | **Movimenti «fluidi» al posto di A1–A4 del piano**, con nuove eccezioni E3 ed E4 ed E1–E2 aggiornate. Decisione riportata dalla regia: il proprietario ha giudicato «banali» i movimenti del piano, ha chiesto movimenti fluidi come il loader di Claude e ha risposto «mi piace» alla versione fluida su una pagina di prova della regia, che confrontava «Fluida» e «Piano #16» (Artifact privato del proprietario). La regia gli aveva detto esplicitamente che servivano le eccezioni. Vedi [Momenti animati](#momenti-animati). |
| 2026-11-20 | **Bordo interno sottile sulla tessera dell'icona** (riportato dalla regia, PR #18): tratto interno `#484848` (Radix gray-8 scuro), circa 1,2% del lato a 1024 px, così la tessera nera si distingue su barre e Dock scuri. Su sfondo chiaro resta quasi invisibile; controllato a 16, 32 e 128 px (`docs/brand/anteprima-icone.png`). |
| 2026-11-20 | **Testi dell'About approvati** (it + en), senza la frase sotto il nome. Vedi [Testi nuovi](#testi-nuovi-it--en--approvati). |
| 2026-11-20 | **Colore: tessera nera, asterisco bianco, ovunque** (macOS, Windows, Linux). Mini sessione sul colore ([Colore del segno](#colore-del-segno)). Scartati gli step 9 Radix (prugna e indaco i migliori), la tessera bianca e la variante chiara/scura su macOS. |
| 2026-11-20 | **Eccezioni a `DESIGN.md` approvate: E1** (About, il segno si disegna in 400 ms all'apertura) **ed E2** (controllo aggiornamenti, movimento in loop finché il controllo è in corso). Vedi [Eccezioni](#eccezioni-a-designmd-approvate). |

## Brief del segno (per il giro dopo il nome)

Cosa insegnano i sei giri, oltre alle regole del prodotto:

- **Deve dire il programma, non solo il nome.** È il motivo per cui la seppia è stata
  respinta. Il segno deve far pensare a ciò che l'app fa: leggere e scrivere i `.md` di un
  progetto, una pagina, una colonna, il testo reso com'è letto. Un gioco sul nome va bene solo
  se regge anche questo.
- **Monocolore, sagoma piena e spessa, forme morbide.** Niente contorni sottili, niente
  dettagli interni che si perdono, una sola tinta. Gli eventuali fori, come gli occhi dei
  giri 5–6, sono vuoti veri, non un secondo colore.
- **Il colore viene dalla palette, ed è inchiostro e carta** (decisione del 2026-11-20).
  L'icona è una tessera `gray-12 #202020` con il segno in `gray-1 #fcfcfc`, uguale su tutte le
  piattaforme. Niente arancio nell'icona, per non somigliare a Claude. Dentro l'app il segno
  usa `currentColor` e prende `--fg` o `--muted-fg`, perché l'arancio resta riservato al
  segnale (`DESIGN.md`, "The Signal Rule").
- **Una sola forma da 16 a 1024 px.** Si disegna su griglia 64, si prova a 16, 24, 32, 48,
  64, 128 e 256 px su fondo chiaro e scuro, e in monocromo. Se a 16–24 px non si legge, si fa
  un disegno semplificato per le misure piccole (vedi le icone sotto).
- **No a:** gradienti, ombre, effetto vetro, testo nel segno, il costume da terminale (`>_`,
  verde su nero), la carta calda (`PRODUCT.md`, "Anti-references"; `DESIGN.md` §6).
- **Si consegna così:** un master SVG 1024×1024 della tessera con il segno; il segno da solo
  in `currentColor` per l'app; la versione monocroma; l'eventuale disegno per le misure piccole.
  Riferimenti attuali: `docs/brand/asterisco-icona.svg`, `asterisco-icona-mono.svg`,
  `asterisco-segno.svg` (viewBox 64; il master 1024 si ricava nella fetta 1).

### Linee guida delle piattaforme (lette il 2026-11-19)

- **macOS.** [Apple HIG, App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons):
  - **Tela e forma.** Tela quadrata 1024×1024; il sistema applica da sé la maschera del
    rettangolo arrotondato, quindi si consegnano livelli quadrati senza maschera.
  - **Aspetti.** Chiaro, scuro, «clear» e «tinted»; quelli mancanti li genera il sistema.
  - **Formati.** Si consegna un PNG oppure un file a livelli di Icon Composer (`.icon`).
  - **Margini.** Non ci sono valori numerici di area sicura: vanno presi dai modelli degli
    Apple Design Resources.
  - **Icone fuori forma.** Su macOS 26 le icone che escono dal rettangolo finiscono su una
    tessera grigia. Il HIG non lo dice; lo riportano
    [heise](https://heise.de/-11075561) e
    [9to5Mac](https://9to5mac.com/2025/08/08/macos-tahoe-fix-gray-box-icons/).
  - **Quindi** su macOS l'icona è una **tessera piena** con il segno dentro, non il segno da
    solo.
- **Windows.** [App icon construction](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-construction)
  e [App icon design](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design):
  - **Misure minime:** 16, 24, 32, 48 e 256.
  - **Fondo.** Trasparente, senza tessera.
  - **Griglia.** 48×48, angoli esterni con raggio 2 px.
  - **Contrasto.** «Almeno metà» dell'icona a 3:1 sia sul tema chiaro sia su quello scuro
    della barra delle applicazioni.
  - **Testo.** Mai nell'icona.
  - **Quindi**, con la scelta del 2026-11-20, anche qui si usa la tessera nera. Microsoft la
    ammette («plate»): chiede di curare il contrasto su entrambi i temi, e la tessera nera con
    l'asterisco bianco lo supera da sola (15,9:1 su chiaro con la tessera, 16,3:1 su scuro
    con l'asterisco).
- **Linux.**
  - **GNOME.** Il [GNOME HIG](https://developer.gnome.org/hig/guidelines/app-icons.html)
    chiede un'area di 128×128 che il segno non riempie del tutto, vista di solito a 64 px. Le
    forme sono semplici, senza ombre fuori dalla sagoma, e c'è anche una versione
    «symbolic».
  - **Cosa installa Tauri 2.12.5.** Il bundler mette nel `.deb` solo i PNG di
    `bundle.icon`, in `hicolor/<N>x<N>/apps/`. Non installa SVG né icone symbolic. L'AppImage
    usa il PNG più grande
    ([sorgente](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.5/crates/tauri-bundler/src/bundle/linux/freedesktop/mod.rs)).
  - **Quindi** si usa la stessa tessera nera. GNOME suggerisce di non riempire tutta l'area: la
    tessera lascia il margine dei modelli macOS.
- **Non verificato:** la specifica freedesktop delle icone (il sito era bloccato dalla rete
  della sessione) e il supporto di `prefers-color-scheme` dentro una favicon SVG su Safari 26.

## Dove compare il logo

| Punto | Cosa | Statico o animato | File oggi |
|---|---|---|---|
| Icona app macOS | Tessera nera con il segno bianco; `.icns` generato e, se possibile, un `.icon` di Icon Composer per macOS 26 | statico | `src-tauri/icons/icon.icns` |
| Icona app Windows | La stessa tessera nera, `.ico` | statico | `src-tauri/icons/icon.ico` |
| Icona app Linux | La stessa tessera nera, PNG in `hicolor` | statico | `src-tauri/icons/{32x32,128x128,128x128@2x}.png` |
| Installer e DMG | Usano l'icona dell'app (installer NSIS, volume del DMG) | statico | come sopra |
| Favicon | Si vede solo aprendo il server di sviluppo in un browser: la finestra Tauri non mostra la favicon. Va comunque sostituita, perché è un viola fuori dalla palette | statico | `public/favicon.svg` |
| Pannello About (nuovo) | Segno grande, nome, versione, licenza, «Controlla aggiornamenti», note di terze parti | **animato**: A2, A3, A4 | — |
| Stato vuoto, nessun documento aperto | Segno piccolo in `--muted-fg` sopra il titolo | statico all'avvio; **animato** (A1) solo quando ci si arriva chiudendo l'ultimo documento | `src/features/welcome/EmptyState.tsx` |
| Documento di benvenuto | **Nessun logo.** È un documento vero e modificabile, e la superficie del documento è «sacra» (`DESIGN.md` §5); il nome resta nel titolo come testo | — | `src/features/welcome/welcome-doc.ts` |
| Note di licenza | **Nessun logo.** `THIRD-PARTY-NOTICES` è un file di testo; il pannello delle note in Impostazioni resta com'è, e l'About porta alle note | — | `src-tauri/about.hbs`, `THIRD-PARTY-NOTICES` |
| README | Segno in testa, versione chiara e scura con `<picture>` e `prefers-color-scheme` | statico | `README.md` |
| Barra del titolo (Windows/Linux), barra di stato, editor | **Nessun logo.** Il cromo si guadagna i pixel, e sulla scrittura non passa niente | — | — |

### File generati da `tauri icon` (Tauri CLI 2.12.5)

Fonti: [Tauri, App icons](https://v2.tauri.app/develop/icons/) e
[`icon.rs`](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.5/crates/tauri-cli/src/icon.rs).

- **Sorgente.** Un PNG o un SVG quadrato con trasparenza: l'SVG viene rasterizzato con resvg
  a ogni misura. Si usa un master 1024×1024.
- **Opzioni.** `-o` sceglie la cartella di uscita, `-p` misure PNG su richiesta, `--fit`
  serve per una sorgente non quadrata.
- **File generati:**
  - `icon.icns`: 16, 32, 64, 128, 256, 512 e 1024 px, nei dieci slot `icon_*`;
  - `icon.ico`: livelli 16, 24, 32, 48, 64 e 256, **senza 20 e 40**;
  - `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png` (256 px) e `icon.png` (512 px);
  - `StoreLogo.png` (50 px) e i nove `Square*Logo.png`, che secondo la documentazione oggi
    non si usano;
  - le icone Android e iOS, in `icons/android` e `icons/ios` se non c'è un progetto mobile.
- **Limiti per noi:**
  - Ogni file è un ridimensionamento della stessa sorgente. Non si può dare un disegno
    dedicato alle misure piccole: se serve, i livelli 16, 24 e 32 di `.ico` e `.icns` vanno
    rimpiazzati dopo la generazione.
  - Con la tessera uguale su tutte le piattaforme basta **una sola sorgente** e un solo
    `tauri icon`.
- **`.icon` (Icon Composer).** Se `bundle.icon` contiene un `.icon`, il bundler esegue
  `actool` e crea `Assets.car`, tenendo `.icns` come riserva. Serve un Mac con Xcode 26 o
  successivo: senza, il bundler lo salta con un errore nel log
  ([`macos/icon.rs`](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.5/crates/tauri-bundler/src/bundle/macos/icon.rs)).
  La CI usa i runner GitHub, quindi va verificata la versione di Xcode del runner prima di
  contarci.

## Tecnica di animazione

Confronto fatto il 2026-11-19 sulla documentazione ufficiale. Pesi misurati con
`bun build --minify` + gzip -9 dove le pagine non lo dicevano.

Due fatti decidono:
- **La CSP dell'app.** `script-src 'self'`, senza `'unsafe-eval'` né `'wasm-unsafe-eval'`
  (`src-tauri/tauri.conf.json`).
- **Il motore più vecchio da supportare.** È **macOS 10.15**
  (`minimumSystemVersion`), con WebKit 609 (circa Safari 13.1): il sistema non lo aggiorna
  più ([Tauri, webview versions](https://v2.tauri.app/reference/webview-versions/)).
  Ubuntu 22.04 oggi è aggiornata a WebKitGTK **2.50.4**
  ([Launchpad](https://launchpad.net/ubuntu/jammy/+source/webkit2gtk)); WebView2 è Chromium
  aggiornato.

| Tecnica | Peso aggiunto | Licenza | WKWebView 10.15 / attuale · WebView2 · WebKitGTK 2.50 | CSP | Riduci movimento | Prestazioni |
|---|---|---|---|---|---|---|
| **CSS (transition, keyframes) su SVG inline + Web Animations API** | 0 KB | piattaforma | sì su tutti: WAAPI attiva in WebKit da Safari 13.1 ([WebKit](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1)) | nessuna modifica | `@media (prefers-reduced-motion)`, già azzerato in `global.css`; `Animation.cancel()` | `transform` e `opacity` sul compositore; `stroke-dashoffset` è pittura, va bene per pochi tracciati |
| **`motion` v14.14.0** (già presente) | ~0: già nel bundle (`LazyMotion` + `domAnimation`); `motion/mini` misurato 3,5 KB | MIT | sì: usa WAAPI dove può ([motion.dev, performance](https://motion.dev/docs/performance)) | nessuna modifica: niente `eval` | `MotionConfig reducedMotion="user"`, già attivo | come WAAPI |
| SMIL (`<animate>`) | 0 KB | piattaforma | sì; mai deprecato davvero ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/5o0yiO440LM)) | nessuna modifica | **non si ferma da CSS**: serve JS (`pauseAnimations()`) o un SVG statico | attributi sul thread principale; scomodo da pilotare dallo stato React |
| Lottie: `lottie-web` 5.13 | 46 KB (build *light*); 62–76 KB le altre | MIT | sì | le build complete usano `eval` per le espressioni ([issue 2927](https://github.com/airbnb/lottie-web/issues/2927)); solo *light* rispetta la CSP | da gestire a mano | SVG o canvas pilotato da JS |
| Lottie: `@lottiefiles/dotlottie-web` 0.83 | 31 KB JS + **492 KB WASM** | MIT | dipende dal WASM: su WebKit 609 dubbio | serve `'wasm-unsafe-eval'`, WASM da ospitare in locale, worker `blob:` ([guida CSP](https://github.com/LottieFiles/dotlottie-web/wiki/CSP-and-WASM-Self%E2%80%90Hosting-Guide)) | da gestire a mano | canvas |
| Rive `@rive-app/canvas-lite` 2.52 | 128 KB JS + **372 KB WASM** (canvas completo: 970 KB) | runtime MIT; editor commerciale | WASM: su WebKit 609 dubbio | serve `'wasm-unsafe-eval'` ([Rive FAQ](https://rive.app/docs/runtimes/web/faq)) | da gestire a mano | canvas: il segno non segue i token del tema |

Da evitare o trattare come extra: `d: path()` (in WebKit solo in Technology Preview), `linear()`
(da Safari 17.2: manca su 10.15), `@starting-style` e View Transitions (da Safari 17.5 e 18):
non ci sono su WebKit 609, quindi si usano solo come miglioramento, con `cubic-bezier` come base.

**Raccomandazione: SVG inline con CSS e Web Animations API**, e `motion` dove l'app lo usa già
(il dialogo About è un `Dialog` animato con `motion`).
- Non aggiunge dipendenze e non cambia la CSP.
- Gira sul motore più vecchio da supportare.
- Il segno prende i colori dai token: segue il tema chiaro o scuro e l'accento senza
  lavoro in più.

Si scartano Lottie e Rive: più peso, WASM, una CSP più larga e colori fuori dai token, per
quattro momenti da pochi tracciati. Si scarta anche SMIL, perché non si ferma da CSS.

## Momenti animati

Movimenti «fluidi», scelti dal proprietario il 2026-11-20 (riportato dalla regia). Sostituiscono la
prima versione del piano (A1 160 ms, A2 400 ms, A3 1200 ms, A4 220 ms), giudicata «banale».

Regole comuni:
- Ogni momento nasce da uno **stato** o da un'**azione dell'utente**. Nessuno parte all'avvio a
  freddo; niente sulla superficie del documento né sul percorso della scrittura.
- Si animano solo `transform` e `opacity`, con la Web Animations API.
- **Con «riduci movimento» non si muove niente** in nessun momento: restano solo i testi.

**Struttura del segno animato.**
- **Albero:** `svg > g.spin > g` (scala 1.15 attorno a 32,32) `> 5 × g` (`rotate(72·i 32 32)`)
  `> path.drop`, più `circle.core`.
- **Origine delle trasformazioni:** su `.spin`, `.drop` e `.core` si usano
  `transform-box: view-box; transform-origin: 32px 32px`.
- **Da verificare:** `transform-box: view-box` sul WebKit di macOS 10.15.

**Curve.**

| Nome | Definizione |
|---|---|
| `SPRING_SOFT` | molla smorzata, k = 170, c = 18, massa 1 |
| `SPRING_POP` | molla smorzata, k = 260, c = 16, massa 1 |
| `EXPO` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `SINE` | `cubic-bezier(0.37, 0, 0.63, 1)` |
| `STEP` | `cubic-bezier(0.45, 0, 0.55, 1)` |

- **Le due molle** si campionano in CSS `linear()`, con 49 punti su un tempo
  T = ln(1000) / (ζ·ω0).
- **Il ripiego.** Se `CSS.supports('transition-timing-function', 'linear(0, 1)')` è falso, si
  usa `cubic-bezier(0.16, 1, 0.3, 1)`. Succede per esempio sul WebKit di macOS 10.15, che non
  ha `linear()`.

**Momenti.**

| # | Stato | Dove | Cosa si muove | Durata | Eccezione |
|---|---|---|---|---|---|
| A1 | Si chiude l'ultimo documento e si torna a «nessun documento». All'avvio a freddo resta statico | Stato vuoto | svg: opacità 0→1, 220 ms, ease-out · `.spin`: `rotate(-40deg) scale(0.55)` → `none`, 620 ms, `SPRING_SOFT` · ogni goccia: `scale(0.85, 0.6)` → 1, 560 ms, ritardo 30·i ms, `SPRING_SOFT` · tutte con `fill: backwards` | ~620 ms | **E3** |
| A2 | L'utente apre l'About | About | `.spin`: `rotate(-90deg)` → 0, 900 ms, `EXPO` · `.core`: scala 0→1, 450 ms, `SPRING_POP` · ogni goccia: `scale(0.3, 0)` → 1, 620 ms, ritardo 80 + 55·i ms, `SPRING_SOFT` | ~920 ms | **E1** |
| A3 | Controllo aggiornamenti in corso, avviato dall'About: il «respiro» | About | periodo P = 1600 ms · ogni goccia: `rotate(0) scale(1,1)` → `rotate(6deg) scale(0.9, 0.68)` → `rotate(0) scale(1,1)`, `SINE` su ogni tratto, infinito, ritardo −i·P/5 (un'onda che passa) · `.core`: scala 1 → 0.8 → 1, periodo P/2, `SINE` · `.spin`: `rotate` 0→72°, periodo P, `STEP`, infinito | cicli da 1600 ms, al massimo 5 s | **E2** |
| A4 | Fine del controllo (esito) | About | vedi sotto: il loop non si cancella di colpo | ~640 ms | **E4** |

**A4, l'arresto morbido.**
1. Si legge `getComputedStyle(el).transform` di ogni parte, poi si cancellano i loop.
2. Ogni goccia va dal valore letto a `none`: 640 ms, ritardo 25·i ms, `SPRING_SOFT`.
3. `.core` va dal valore letto a `scale(1)`: 520 ms, `SPRING_POP`.
4. `.spin` va dall'angolo corrente al multiplo di 72° successivo: 640 ms, `SPRING_SOFT`.
   - L'angolo corrente è l'atan2 della matrice, normalizzato fra 0 e 360.
   - Il multiplo successivo è `ceil((a + 8) / 72) · 72`.
   - Per la simmetria a cinque, alla fine il segno è identico a quello di partenza.
5. Se il loop si era già fermato al limite dei 5 s, all'esito si anima solo `.spin`:
   `scale(0.9)` → 1, 560 ms, `SPRING_POP`.

**Rischio.** Un segno radiale che «respira» durante un caricamento può ricordare il loader di
Claude. Il proprietario ha visto la prova e l'ha approvata così. A distinguerli restano:
- il colore: il segno nell'app è in `currentColor`, quindi grigio, non corallo;
- la forma: cinque gocce;
- il contesto: compare solo nell'About e solo durante il controllo aggiornamenti.

Il controllo aggiornamenti avviato dal menu o dalla palette resta com'è oggi: solo i toast, senza
il segno.

Accessibilità:
- **Il segno.** È decorativo dove il nome è già scritto accanto: `aria-hidden="true"` nello
  stato vuoto e nell'About.
- **Lo stato del controllo.** Si annuncia a parole in una regione `aria-live="polite"`,
  mai con l'animazione sola.
- **Il loop di A3.** Si ferma da solo entro 5 s, al limite di WCAG 2.2.2 «Pause, Stop, Hide»,
  e si ferma subito quando il controllo finisce o quando l'About si chiude.
- **Il focus.** Va a «Chiudi» o al primo controllo dell'About, mai sul segno.

### Eccezioni a `DESIGN.md` approvate

Approvate dal proprietario il 2026-11-20:
- **E1 ed E2** con una domanda diretta di questa sessione;
- **E3, E4 e le nuove durate** scegliendo la versione «fluida» sulla pagina di prova della
  regia, dopo che la regia gli aveva detto esplicitamente che servivano.

| Eccezione | Momento | Prima | Ora |
|---|---|---|---|
| E1 | A2, apertura dell'About | 400 ms | ~920 ms |
| E2 | A3, controllo in corso | loop da 1200 ms, al massimo 5 s | loop da 1600 ms, al massimo 5 s |
| E3 | A1, ritorno allo stato vuoto | 160 ms, dentro le regole | ~620 ms |
| E4 | A4, esito del controllo | 220 ms, dentro le regole | ~640 ms |

Siccome `DESIGN.md` vince sul visivo, la fetta di implementazione **deve** aggiornare i due
documenti nello stesso commit delle animazioni:

- **`DESIGN.md` §5, Motion**: dopo «All motion collapses to instant under
  `prefers-reduced-motion: reduce`.» aggiungere:

  > **The logo exception.** The app mark is the one documented exception to these bounds. It
  > moves on springs, in four moments only:
  > - when the empty state returns after the last document closes (~`620ms`);
  > - when the About panel opens (~`920ms`);
  > - while an update check started from About is running: a `1600ms` breathing loop that
  >   stops by itself after `5s`;
  > - when that check settles (~`640ms`).
  >
  > It never moves at cold launch, on the document surface or on the typing path, and it is
  > instant under reduced motion (owner decision, 2026-11-20).

- **`DESIGN.md` §1, Key Characteristics**: la riga «Motion 120–220ms…» diventa
  «Motion 120–220ms (the app mark is the one, documented exception), nothing on the typing
  path, and no entrance choreography at launch.»
- **`PRODUCT.md`**: niente da cambiare. Le eccezioni non toccano l'avvio a freddo né la
  scrittura. La personalità («quick, crafted, unceremonious», emozione «quiet delight») spiega
  perché il movimento sta solo nel segno e in stati scelti.

## Testi nuovi (it + en) — approvati

**Approvati dal proprietario il 2026-11-20**, senza la frase sotto il nome, che è tolta. Dove una chiave esiste già, si riusa invece di crearne una nuova.
`{{name}}` è il nome del prodotto, che arriva con la PR del nome.

| Chiave (proposta) | Italiano | English | Note |
|---|---|---|---|
| `menu.app.about` | Informazioni su {{name}} | About {{name}} | esiste già (`menu.json`); diventa un comando dell'app al posto della voce nativa; su Windows/Linux va nel menu Aiuto |
| `editor.about.title` | Informazioni su {{name}} | About {{name}} | titolo del dialogo |
| `editor.about.version` | Versione {{version}} | Version {{version}} | numero in mono (`DESIGN.md`, "The Machine-Data Rule") |
| `editor.about.license` | Software libero e open source, licenza MIT. | Free and open-source software, MIT license. | «license» come nel resto dell’app |
| `editor.about.checkUpdates` | Controlla aggiornamenti | Check for updates | il menu tiene «Check for Updates…» |
| `editor.about.checking` | Controllo in corso… | Checking for updates… | letto dalla regione `aria-live` |
| `editor.about.notices` | Note di terze parti | Third-party notices | riusare `editor.settings.notices.title` |
| `editor.about.close` | Chiudi | Close | riusare la chiave «Close» già presente |

Gli esiti del controllo («Hai già l'ultima versione», «Controllo aggiornamenti fallito: …») si
riusano da `editor.notify.*`.

## Cosa si riusa con il nome nuovo

Si riusa tutto tranne il segno:
- il brief;
- l'inventario dei punti;
- la tecnica;
- i momenti A1–A4 e le eccezioni E1–E4;
- i testi, dove `{{name}}` resta una variabile;
- le fette 2–4.

I concept per «Seppia» sono stati tolti quando è arrivato il segno nuovo (restano
nell'archivio); in `docs/brand/concept/` ci sono solo quelli del giro per Asterisco.

## Fette di implementazione

In fila, perché toccano file condivisi (`docs/regia.md`).

### Fetta 0 — prerequisito: il nome

Nome nuovo scelto e applicato nella sua PR (`docs/release-1.0.md`, «Cosa tocca il nome»).
Poi c'è un nuovo giro di concept con il [brief](#brief-del-segno-per-il-giro-dopo-il-nome).

Scelto il segno, si salvano in `docs/brand/`:
- il master SVG;
- il disegno per le misure piccole, se serve;
- le versioni chiara, scura e monocroma.

### Fetta 1 — icone e favicon (solo asset, niente codice)

- **Sorgente.** `src-tauri/icons/source/app-icon.svg`, la tessera nera con l'asterisco
  bianco, 1024×1024, ricavata da `docs/brand/asterisco-icona.svg`.
- **Generazione.** `bun tauri icon src-tauri/icons/source/app-icon.svg`. Se c'è il disegno per
  le misure piccole, si sostituiscono i livelli 16, 24 e 32 di `.ico` e `.icns`.
- **Configurazione.** `bundle.icon` in `tauri.conf.json` aggiunge `icons/icon.png` (512 px),
  così l'AppImage e il `.deb` hanno un'icona grande. Il file è condiviso: serve una sessione
  alla volta.
- **Favicon.** `public/favicon.svg`: la stessa tessera nera, che regge su schede chiare e
  scure senza `prefers-color-scheme`.
- **Facoltativo, sul Mac del proprietario.** Un `.icon` di Icon Composer (Xcode 26), se la
  versione di Xcode della CI lo permette.
- **README.** Il segno in testa, con `<picture>`.
- **Controlli.**
  - Se la build Linux lo permette, `bun run tauri build --bundles deb` nella CI `bundle`.
  - Elenco dei file generati con le misure.
  - Licenza del segno: è nostro, MIT, senza note di terze parti.

### Fetta 2 — componente del segno e About (codice)

- **Il segno come componente.**
  - `src/components/brand/AppMark.tsx`: SVG inline, `currentColor`, `aria-hidden` di default
    e una prop `label` per i casi in cui serve il nome.
  - `src/components/brand/app-mark.css`: solo `transform-box` e `transform-origin` delle parti
    (`.spin`, `.drop`, `.core`). Le animazioni sono nella fetta 3, in WAAPI.
- **L'About.**
  - Il dialogo: `src/features/about/AboutDialog.tsx`, su `src/components/ui/dialog.tsx`, che ha
    già il focus trap e la chiusura con Esc.
  - Il comando: `src/features/about/about-command.ts`, registrato tra i comandi.
  - La versione arriva da `@tauri-apps/api/app` `getVersion()`, oppure da una costante di
    build.
- **Menu.**
  - In `src/app/menu/menu-model.ts` la voce `{ kind: "predefined", role: "about" }` diventa
    `{ kind: "command", command: "about" }`.
  - Su Windows e Linux si aggiunge «about» al menu Aiuto.
  - `src-tauri/src/menu/mod.rs` (`startup_spec`) tiene la voce nativa solo finché il frontend
    non manda il suo menu: va deciso con la sessione IPC/Rust se lasciarla.
- **Il controllo aggiornamenti.** `check-updates.ts` espone uno stato (in corso / esito), così
  l'About può mostrare A3 e A4. I toast del menu non cambiano.
- **Stato vuoto.** In `EmptyState.tsx` il segno va sopra il titolo; A1 solo quando si arriva lì
  chiudendo l'ultimo documento.
- **Testi.** Le chiavi sopra, in `src/i18n/locales/{it,en}/*.json`, file condivisi; il test di
  parità `resources.test.ts` le controlla.
- **Test.**
  - Unità: `AppMark` (ruolo, `aria-hidden`, `label`).
  - About:
    - versione mostrata;
    - pulsante che avvia il controllo;
    - regione `aria-live` che annuncia «Controllo in corso…» e l'esito;
    - focus iniziale e ritorno del focus alla chiusura.
  - Menu: la voce about su ogni piattaforma, aggiornando `AppMenubar.test.tsx` e il test del
    modello di menu.
  - e2e: un passo nel giro di tastiera (`e2e/a11y.spec.ts`), cioè aprire l'About da tastiera e
    chiuderlo con Esc.

### Fetta 3 — animazioni ed eccezioni (codice + documenti)

- **Le animazioni.** In `src/components/brand/app-mark-motion.ts`, tutte con WAAPI
  (`element.animate`):
  - le curve, con il campionamento delle molle in `linear()` e il ripiego;
  - A1–A4 e l'arresto morbido di A4;
  - il limite di 5 s per A3.

  In `src/lib/motion.ts` si aggiungono le costanti (durate, k e c delle molle, periodo di A3).
  `global.css` cambia solo se servono variabili CSS: i token di tema sono condivisi.
- **I documenti.** `DESIGN.md` e `PRODUCT.md` si aggiornano come in
  [Eccezioni](#eccezioni-a-designmd-approvate), nello stesso commit.
- **Test.**
  - Con `matchMedia('(prefers-reduced-motion: reduce)')` simulato non parte nessuna
    animazione.
  - Con i timer finti il loop si ferma a 5 s, alla fine del controllo e alla chiusura del
    dialogo.
  - Le molle campionate partono da 0 e finiscono a 1, con 49 punti.
  - Senza `linear()` si usa il ripiego `cubic-bezier`.
  - L'angolo di arrivo di `.spin` è sempre un multiplo di 72° maggiore dell'angolo corrente.
  - Arresto morbido: le animazioni di loop vengono cancellate e non resta nessuna animazione
    attiva dopo ~700 ms.
  - All'avvio a freddo lo stato vuoto non ha classi di animazione (test di regressione su
    «Nothing animates at launch»).
  - e2e con `reducedMotion: 'reduce'` di Playwright: l'About si apre con il segno già intero.
- **Accessibilità, da controllare a mano:**
  - VoiceOver (macOS) e NVDA (Windows) leggono il titolo dell'About e lo stato del controllo,
    e non leggono il segno;
  - il focus è visibile su ogni controllo;
  - il contrasto del segno in `--muted-fg` è almeno 3:1 sullo sfondo, in chiaro e in scuro, per
    ogni neutro;
  - con «riduci movimento» attivo nel sistema non si muove niente.

### Prove sui dispositivi (da aggiungere alla lista di `docs/release-1.0.md`)

| Cosa fare | Cosa deve succedere |
|---|---|
| macOS: guardare l'app nel Dock, in Finder, nel Launchpad, nel DMG, in chiaro e in scuro | l'icona è la tessera nuova, nitida, senza tessera grigia attorno |
| Windows: barra delle applicazioni chiara e scura, menu Start, Esplora file a 100% e 150% | l'icona è nitida a 16, 24 e 32 px e si vede su entrambi i temi |
| Linux: dock di GNOME, lista applicazioni, AppImage | l'icona è quella nuova, non sfocata |
| Avviare l'app senza documenti | lo stato vuoto mostra il segno fermo, nessuna animazione |
| Aprire un documento e chiuderlo | il segno ricompare ruotando e assestandosi a molla (A1), senza scatti |
| Aprire l'About dal menu (macOS: menu app; Windows/Linux: Aiuto) | le gocce sbocciano dal centro mentre il segno ruota, una volta (A2); nome, versione 1.0.0 e licenza sono corretti, in it e in en |
| Nell'About, «Controlla aggiornamenti» | il segno «respira» finché il controllo è in corso, al massimo 5 s (A3); all'esito si ferma con morbidezza, senza salti (A4) |
| Ripetere con «riduci movimento» attivo nel sistema | nessun movimento, stessi testi |
| Solo tastiera: aprire l'About, raggiungere ogni controllo, chiudere con Esc | il focus è sempre visibile e torna dove era |
| Ubuntu 22.04 (WebKitGTK 2.50) e, se disponibile, macOS 10.15 | le animazioni girano senza errori in console; su 10.15 con il ripiego `cubic-bezier` |

## Concept per Asterisco

Giro del 2026-11-20, in `docs/brand/concept/`, ciascuno con `-light`, `-dark` e `-mono`
(viewBox 64×64). I concept qui sono disegnati in arancio `orange-9`; il colore definitivo è in
[Colore del segno](#colore-del-segno). Nei concept 4 e 5 l'asterisco è un foro vero (maschera), non un secondo colore.

| # | Concept | File | Note | Stato |
|---|---|---|---|---|
| 1 | Sei bracci tondi | `as1-sei-bracci-*` | il più nitido a 16 px; bracci che crescono dal centro (A2), rotazione di 60° in loop (A3) | non scelto |
| 2 | Cinque gocce | `as2-cinque-gocce-*` | asterisco tipografico, il più morbido | **scelto 2026-11-20** |
| 3 | Sei gocce | `as3-sei-gocce-*` | morbido e simmetrico | non scelto |
| 4 | Pagina con asterisco | `as4-pagina-*` | documento + Markdown; già una tessera per macOS | non scelto |
| 5 | Pagina con l'orecchio | `as5-pagina-piega-*` | il più riconoscibile come file, ma generico | non scelto |

### Colore del segno

**Scelto il 2026-11-20: tessera nera (`gray-12 #202020`) con l'asterisco bianco
(`gray-1 #fcfcfc`), su macOS, Windows e Linux.**

Il marchio di Claude è un simbolo radiale color corallo-arancio (`#d97757`, dai documenti di
branding della piattaforma Anthropic), e il pubblico dell'app scrive `CLAUDE.md`. Per questo il
segno a cinque gocce **non usa l'arancio**. Dentro l'app il segno usa `currentColor` (`--fg` o
`--muted-fg`), e il segnale arancio dell'interfaccia resta com'è.

Il metodo della mini sessione, 2026-11-20:

1. **Criteri:**
   - contrasto: almeno metà dell'icona sopra 3:1 sulla barra chiara e su quella scura
     ([Microsoft](https://learn.microsoft.com/en-us/windows/apps/design/iconography/app-icon-design));
   - distanza da Claude anche con protanopia e deuteranopia, simulate con le matrici di
     [Machado 2009](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)
     e misurate in ΔE CIELAB;
   - una zona libera tra le app vicine;
   - armonia con l'arancio dell'interfaccia;
   - colori dalla palette Radix.
2. **Le app vicine:**
   - il blu è affollato: VS Code, [Zed](https://zed.dev/brand),
     [Docker](https://www.docker.com/?p=32604), Xcode;
   - il viola ha [Obsidian](https://obsidian.md/brand);
   - nero e bianco sono di [Cursor](https://cursor.com/brand), ChatGPT, Notion e dei
     terminali;
   - avere icona e accento dell'interfaccia di colori diversi è prassi comune
     ([Linear](https://linear.app/brand),
     [GitHub Desktop](https://primer.style/desktop/foundations/color)).
3. **Gli scartati:**
   - verde acqua e giada: con la protanopia si confondono con il corallo (ΔE 17–25);
   - cremisi: troppo vicino al corallo;
   - blu: la zona più affollata.
4. **I finalisti a colore** (prugna, porpora, indaco, viola) sono stati provati in una finta
   barra, accanto ai colori delle app vicine. Il proprietario ha poi chiesto un segno tendente
   al nero, e infine ha scelto la tessera nera. È la soluzione più semplice:
   - nessuna somiglianza di colore con Claude;
   - regge su barre chiare e scure;
   - è coerente con «il manuale ben composto» di `DESIGN.md`;
   - nel Dock si distingue dalle altre icone nere per la forma.

Misure delle alternative valutate (step 9 Radix). Il contrasto è misurato su `#fcfcfc` (chiaro)
e su `#111111` (scuro). Windows chiede che almeno metà dell'icona superi 3:1 su entrambi i
temi della barra.

| Colore | Valore | Su chiaro | Su scuro | Nota |
|---|---|---|---|---|
| Indaco | `indigo-9 #3e63dd` | 5,07:1 | 3,63:1 | sopra 3:1 su entrambi; il più lontano da Claude (raccomandato) |
| Prugna | `plum-9 #ab4aba` | 4,63:1 | 3,97:1 | sopra 3:1 su entrambi |
| Blu | `blue-9 #0090ff` | 3,18:1 | 5,78:1 | colore di moltissime app |
| Verde acqua | `teal-9 #12a594` | 2,99:1 | 6,15:1 | sotto 3:1 su chiaro |
| Giada | `jade-9 #29a383` | 3,07:1 | 5,99:1 | al limite su chiaro |
| Inchiostro senza tessera | `gray-12 #202020` | 15,88:1 | 1,16:1 | sparisce sulle barre scure |
| **Tessera nera, asterisco bianco** | `#202020` + `#fcfcfc` | 15,88:1 (tessera) | 16,25:1 (asterisco) | **scelta** |
| Tessera bianca, asterisco nero | `#fcfcfc` + `#202020` | 15,88:1 (asterisco) | 16,25:1 (tessera) | scartata: su barra chiara il bordo sparisce, su scura abbaglia |

File di prova: `as2-cinque-gocce-indaco-*` e `as2-cinque-gocce-prugna-*`.

## Concept respinti (archivio)

I file non sono più in questo repository: sono rimasti nell'archivio del repository
precedente. Ciascuno aveva le versioni `-light`, `-dark` e `-mono` (viewBox 64×64).
Respinti il 2026-11-19 (giri 1–5) e il 2026-11-20 (giro 6, insieme al nome «Seppia»).

| Giro | Concept | File |
|---|---|---|
| 1 | Seppia di profilo, goccia sulla riga, «s» con punto, osso di seppia | `a-seppia-*`, `b-goccia-*`, `c-esse-*`, `d-osso-*` |
| 2 | Seppia di profilo e dall'alto, mantello o occhi arancio | `m-profilo-*`, `n-profilo-occhio-*`, `o-alto-*`, `p-alto-occhi-*` |
| 3 | Seppia di fronte, piena e spessa | `q-mantello-*`, `r-occhi-*`, `s-sei-braccia-*`, `t-tutta-arancio-*` |
| 4 | Seppia di fronte, morbida | `u-morbida-*`, `v-morbida-occhi-*`, `w-tre-braccia-*`, `x-pinne-arancio-*` |
| 5 | Seppia monocolore | `y-arancio-*`, `z-inchiostro-*`, `za-dita-*`, `zb-sagoma-*` |
| 6 | Varianti della sola sagoma | `t1-due-braccia-*` … `t6-gonna-*` |

La pagina di confronto usata durante la sessione era privata; la copia di riferimento dei
concept respinti è nell'archivio.
