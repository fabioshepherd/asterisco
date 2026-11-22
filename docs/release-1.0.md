# Rilascio 1.0 — cosa resta al proprietario

Preparato il 2026-11-19 e aggiornato il 2026-11-20, quando il proprietario ha deciso di
pubblicare la 1.0 da un repository pubblico nuovo. Il consolidamento è chiuso (PR #13 del
repository precedente); il codice è pronto. Il rilascio richiede solo le azioni qui sotto,
nell'ordine. Le istruzioni generali restano in `docs/RELEASING.md`; questa pagina è la lista
operativa per la 1.0. I numeri di PR fino alla #21 si riferiscono al repository precedente,
oggi archivio privato.

| # | Azione | Chi | Stato |
|---|---|---|---|
| 1 | Scegliere il nome del prodotto | proprietario | **fatta** (2026-11-20): «Asterisco» (`docs/naming.md`) |
| 2 | Applicare il nome nei file elencati sotto | sessione, dopo la scelta | **fatta** (2026-11-20, PR #17); testi visibili approvati dal proprietario il 2026-11-20. Logo, icone e pannello About nelle PR #16, #18, #19, #20 |
| 3 | Generare la propria chiave dell'updater, mettere la pubblica in `tauri.conf.json`, la privata nei segreti del repository | proprietario | **fatta** (2026-11-20): coppia di chiavi del proprietario (id minisign `7E06AE5B898C6E12`) — vedi "Chiave dell'updater". Nel repository pubblico il segreto si ricrea con la stessa chiave (azione 5) |
| 4 | Firma macOS / Windows | proprietario | **rimandata** (decisione 2026-08-17): la 1.0 esce non firmata |
| 5 | **Repository pubblico** (progetto in `docs/superpowers/specs/2026-11-20-public-repo-design.md`, fasi 1–2): pulizia del repository precedente in tre fette (codice, documenti, impostazione open source) unite su `main`; controllo finale; il vecchio repository diventa l'archivio privato `asterisco-archivio`; un solo commit con l'albero di `main` nel nuovo `fabioshepherd/asterisco`, reso pubblico subito; configurazione (ruleset su `main`, segreto `TAURI_SIGNING_PRIVATE_KEY`, segnalazione privata delle vulnerabilità, scansione dei segreti, Dependabot); prova della CI con una PR | regia e proprietario | **fatta** (2026-11-22): pulizia unita nell'archivio (PR #22, #23, #24); commit unico `4703d68` nel nuovo `fabioshepherd/asterisco`, pubblico dal 2026-11-22; impostazioni applicate e verificate; segreto caricato dal proprietario; prova della CI con la PR #7 (tutti i controlli verdi, `bundle` e CodeQL compresi) |
| 6 | Il giorno del tag: `bun run version:set 1.0.0 <data>` + `src-tauri/Cargo.lock`, togliere la nota "pre-1.0" in cima al `CHANGELOG.md`, con una PR nel repository pubblico | sessione, su richiesta esplicita | **decisa** (2026-11-20): la data della 1.0 è il giorno del tag; il cambio di versione si fa subito prima del tag, con la data di quel giorno |
| 7 | Prova sui dispositivi (lista sotto), su una build vera di ogni piattaforma | proprietario | aperta |
| 8 | `git tag app-v1.0.0` + push nel repository pubblico; verificare la release in bozza; pubblicarla | proprietario | aperta |

Nel repository precedente risultano pubblicate `app-v0.2.0`, `app-v0.2.1` e `app-v0.4.0`
(giugno 2026), ma sono release di prova del proprietario, non distribuite (precisazione del
proprietario, 2026-11-20). Usano l'identifier provvisorio e la chiave segnaposto
dell'updater, quindi non si aggiornano da sole alla 1.0: si reinstalla a mano. Restano
nell'archivio; nel repository pubblico non esistono. Per questo identifier e nome si sono
potuti cambiare senza costi per gli utenti; il proprietario ha confermato
`it.fabiopastore.asterisco` il 2026-11-20 dopo averlo saputo. Dopo la 1.0 cambiarli
romperebbe aggiornamenti e impostazioni.

Decisioni del proprietario del 2026-11-20 per l'applicazione del nome:
- identifier `it.fabiopastore.asterisco` (dominio `fabiopastore.it`, del proprietario);
- repository `fabioshepherd/asterisco`: l'endpoint dell'updater punta lì. Con il
  repository pubblico (azione 5) il nome resta lo stesso, quindi l'endpoint non cambia;
- «Asterisco» uguale in italiano e in inglese; `asterisco` in minuscolo per
  eseguibile, pacchetto `.deb`, pacchetto npm e file di log. Si rinomina il pacchetto
  Cargo invece di impostare `mainBinaryName`, come consiglia lo schema di
  configurazione di Tauri 2;
- consenso esplicito in chat per modificare `CLAUDE.md` e `release.yml` (`releaseName`).

## Decisioni del proprietario, 2026-11-20 (logo, animazioni)

Prese dal proprietario il 2026-11-20:

- **Il nome «Asterisco» è definitivo.** Le verifiche su marchio e dominio sono
  utili ma non bloccano il rilascio: il prodotto è gratuito.
- **Animazioni fluide approvate**, comprese le eccezioni E3/E4 (A1 ~620 ms,
  A4 ~640 ms) e l'allungamento di E1/E2 (A2 ~920 ms, A3 con ciclo di 1600 ms,
  al massimo 5 s).
- **Rotazione di A3 («respiro»):** nella PR #20 la rotazione non è più di 72°
  che ripartono a ogni ciclo, come nel piano, ma un giro completo a passi di 72°,
  così l'onda della goccia non salta a ogni ripartenza. Il proprietario l'ha
  provata e approvata chiedendo il merge della PR #20.
- **Icona:** aggiunto un sottile bordo interno `#484848`.
- **Testi approvati:** tutti i testi del pannello About e quelli del nome.
- **Release di prova del 2026-06** (`app-v0.2.0`, `app-v0.2.1`, `app-v0.4.0`):
  non sono distribuite.
- **Build di rilascio:** le build macOS e Windows della release vengono dalla CI
  sul tag (release in bozza); `bun tauri build` in locale serve solo per le prove
  sui dispositivi (domanda del proprietario, 2026-11-20).
- **Chiave privata dell'updater senza password:** il segreto
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` manca di proposito. `release.yml` passa
  allora una stringa vuota, che è il valore giusto per una chiave senza password.
- **Data della 1.0 = giorno del tag:** `bun run version:set 1.0.0 <data>` si
  esegue subito prima del tag, con la data di quel giorno (riga 6 della tabella).

## Decisioni del proprietario, 2026-11-20 (repository pubblico)

Progetto completo in `docs/superpowers/specs/2026-11-20-public-repo-design.md`.

- **Repository nuovo e pubblico, con poca storia:** un solo commit con l'albero pulito di
  `main`. La storia completa resta nel repository precedente, rinominato
  `asterisco-archivio` e tenuto privato; non si cancella.
- **Tutto pubblico**, documenti di lavoro compresi, dopo averli ripuliti e aggiornati.
- **Segnalazioni solo tramite GitHub** (segnalazione privata delle vulnerabilità);
  nessuna email nei file.
- **Contatto del codice di condotta:** solo il profilo GitHub del proprietario, senza un
  canale privato. Il proprietario accetta consapevolmente che GitHub non ha messaggi
  privati (decisione del 2026-11-20, dopo che la revisione esperta lo ha fatto notare).
- **Testi approvati così come sono scritti** (in inglese, PR #23): i moduli per le issue
  (segnalazione di un problema, proposta, `config.yml`), il modello di PR e la frase sui
  tempi di risposta in `SECURITY.md`.
- **Ordine:** prima il repository pubblico (azione 5), poi cambio di versione e tag
  (azioni 6–8). I commit usano l'indirizzo noreply di GitHub.
- **Consenso** alla riscrittura di `CLAUDE.md` e alle modifiche ai workflow descritte nel
  progetto, solo quelle.

## Cosa tocca il nome

**Applicato il 2026-11-20** (ramo `naming/apply`): tutte le righe di "Da cambiare" sono
fatte; favicon e icone sono arrivate con la fetta del logo.

Inventario fatto cercando il nome di lavoro in tutto l'albero, esclusi `node_modules`,
`target`, `dist`.

### Da cambiare — visibile all'utente o identità dell'app

| File | Cosa | Note |
|---|---|---|
| `src-tauri/tauri.conf.json` | `productName` | nome del bundle `.app`/`.dmg`, installer, voce nel sistema |
| `src-tauri/tauri.conf.json` | `app.windows[0].title` | titolo della finestra |
| `src-tauri/tauri.conf.json` | `identifier` (allora provvisorio) | da rivedere ora: decide la cartella dati/impostazioni e l'identità dell'app per l'OS; dopo il primo feed pubblicato non si cambia più |
| `src-tauri/tauri.conf.json` | `bundle.longDescription` | inizia con il nome (testo approvato 2026-11-19: cambia solo il nome) |
| `src-tauri/tauri.conf.json` | `plugins.updater.endpoints` | solo se il repository viene rinominato (`owner/repo` nuovo) |
| `src-tauri/Cargo.toml` (+ `Cargo.lock`) | `[package] name` | è il nome dell'eseguibile installato (binario, pacchetto `.deb`) se non si imposta `mainBinaryName` |
| `package.json` | `name` | interno, ma va allineato |
| `src/i18n/locales/{it,en}/common.json` | `app.title` | it + en |
| `src/i18n/locales/{it,en}/menu.json` | `app.name`, `app.about` ("Informazioni su …" / "About …") | it + en |
| `index.html` | `<title>` | |
| `public/favicon.svg` | `aria-label` | |
| `src-tauri/src/menu/mod.rs` | nome di riserva del menu app | |
| `src-tauri/src/lib.rs` | nome del file di log | |
| `src-tauri/src/commands/themes.rs` | intestazione del tema di esempio scritto nella cartella temi | |
| `src/features/welcome/welcome-doc.ts` (+ test) | titolo del documento di benvenuto, it + en | |
| `src/app/chrome/AppMenubar.test.tsx` | regex sul nome del menu | test |
| `src-tauri/about.hbs`, `THIRD-PARTY-NOTICES`, `src-tauri/THIRD-PARTY-NOTICES.txt` | intestazione delle note di licenza | rigenerare con `bun run notices` |
| `.github/workflows/release.yml` | `releaseName` | **workflow: serve il consenso esplicito del proprietario** |
| `README.md`, `PRODUCT.md`, `DESIGN.md` (frontmatter `name` + titolo), `ARCHITECTURE.md`, `docs/ROADMAP.md` (chiudere il gate del nome), `docs/RELEASING.md` (endpoint, nome file della chiave) | documenti | |
| `CLAUDE.md` | titolo e prima riga | **serve il consenso esplicito del proprietario** |

### Interni — rinominati anche loro il 2026-11-20

In un primo tempo chiavi `localStorage`, chiavi dei plugin ProseMirror, l'id del tema
utente, le cartelle temporanee dei test Rust e i dati di prova erano rimasti con il nome
di lavoro, per non azzerare le impostazioni delle installazioni esistenti. Visto che non
ci sono installazioni da preservare, la pulizia per il repository pubblico (azione 5) li
ha rinominati con il prefisso `asterisco` (per esempio `asterisco.theme-pref`,
`asterisco-user-theme`), senza migrazione, e ha tolto l'hook di sviluppo non usato.
Anche i documenti storici (`CHANGELOG.md`, `docs/consolidation/**`, `docs/revisione/**`)
sono stati ripuliti: il nome di lavoro resta solo in `docs/naming.md` e nel `CHANGELOG.md`,
dove serve a capire la storia (e, di proposito, nel progetto
`docs/superpowers/specs/2026-11-20-public-repo-design.md`, che descrive la pulizia).

## Chiave dell'updater

- **Segnaposto sostituito il 2026-11-20.** `plugins.updater.pubkey` in
  `src-tauri/tauri.conf.json` era il segnaposto committato (chiave minisign con id
  `3BFCC0D31BCE36A0`); ora contiene la chiave pubblica del proprietario (id
  `7E06AE5B898C6E12`, generata il 2026-11-20 con `bunx tauri signer generate`,
  `docs/RELEASING.md` punto 1). La privata è nel segreto
  `TAURI_SIGNING_PRIVATE_KEY` del repository (senza password: il segreto
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` manca di proposito), aggiornato dal proprietario il
  2026-11-20, da ricreare con la stessa chiave nel repository pubblico. Va conservata una copia di
  sicurezza della privata: se si perde, le installazioni esistenti non ricevono
  più aggiornamenti.
- Verifica del 2026-11-20: i controlli del passo "Preflight - updater config",
  eseguiti in locale, passano con la chiave nuova e fermano ancora la release con
  il segnaposto.
- **Guardia della release corretta.** Il passo "Preflight - updater config" di
  `.github/workflows/release.yml` cercava la sottostringa `UldRakQwRFJnTGJv`
  (inizio di una chiave precedente, id `FEE8B680D1400F23`), che non compariva
  più nel file: con il segnaposto ancora al suo posto la build sarebbe passata,
  i pacchetti sarebbero stati firmati con la chiave privata vera e le app
  installate avrebbero verificato con la pubblica sbagliata, senza ricevere mai
  aggiornamenti. Ora la guardia confronta l'intero segnaposto attuale e ferma la
  release finché non viene sostituito (modifica al workflow autorizzata dal
  proprietario in chat, 2026-11-19).
- La CSP e l'endpoint non cambiano con la chiave; l'endpoint cambia solo se cambia
  `owner/nome` del repository (il repository pubblico tiene `fabioshepherd/asterisco`).

## Firma macOS e Windows

Decisione già presa (2026-08-17, `docs/ROADMAP.md`; `docs/RELEASING.md` punti 3–4):
la 1.0 esce **non firmata**. Su macOS Gatekeeper avvisa al primo avvio (tasto
destro → Apri, oppure `xattr -dr com.apple.quarantine`); su Windows compare
l'avviso SmartScreen. Il workflow firma da solo quando i segreti ci sono; senza,
produce bundle non firmati. Nulla da fare per la 1.0.

## Suite manuale

Le aree `bundle-windows`, `bundle-macos` e `tutto` del workflow `Manual suite`
**non** si aggiungono per la 1.0 (decisione del proprietario, 2026-11-19): la
prima build Windows e macOS è quella del tag, che crea una release **in bozza**.
Se un job fallisce, la bozza non si pubblica: si corregge su un ramo con PR, si
cancella la bozza e il tag fallito, e si rilancia il tag sullo stesso numero
solo se nessuna release è stata pubblicata.

## Prova sui dispositivi

Una sola lista: la checklist di `docs/RELEASING.md` più le prove sui dispositivi
della PR #12. Da fare su una build vera (il bundle della release in bozza, o
`bun tauri build`) su **macOS, Windows e Linux**, un giro in italiano e uno in
inglese. "Mod" è Cmd su macOS e Ctrl su Windows/Linux. Fermarsi e correggere a
ogni voce che non va prima del tag.

### Installazione

| Cosa fare | Cosa deve succedere |
|---|---|
| macOS: aprire il `.dmg`, trascinare l'app in Applicazioni, avviarla | Gatekeeper avvisa (app non firmata); con tasto destro → Apri l'app parte |
| Windows: eseguire l'installer NSIS | SmartScreen avvisa; "Esegui comunque" installa e avvia l'app |
| Linux: installare il `.deb` e avviare l'AppImage | entrambi si avviano |
| Doppio clic su un file `.md` nel file manager | l'app si apre (o è proposta) e mostra il file |
| Aprire Aiuto / menu dell'app → About (macOS, Windows, Linux) | il dialogo mostra il segno, il nome, la versione 1.0.0, la licenza, il controllo aggiornamenti e le note di terze parti |

### File e salvataggio

| Cosa fare | Cosa deve succedere |
|---|---|
| Mod+N, scrivere del Markdown, Mod+S | il file è scritto su disco e il pallino "non salvato" sparisce |
| File ▸ Salva con nome su un percorso nuovo | il file nuovo è scritto; la scheda segue il nuovo percorso |
| Modificare un file già salvato | compare il pallino; salvando sparisce |
| Windows/Linux: Mod+N, Mod+O, Mod+W, Mod+Q | nuovo file, dialogo Apri, chiusura scheda, uscita (con richiesta di salvataggio se serve) |

### Cartella e modifiche esterne

| Cosa fare | Cosa deve succedere |
|---|---|
| Aprire una cartella | l'albero mostra il contenuto |
| Aprire un file dall'albero | il contenuto si carica nell'editor |
| Modificare il file aperto con un altro editor | compare la richiesta di ricaricare; ricaricando si vede il contenuto su disco |
| Cancellare il file aperto da fuori | compare la notifica di file cancellato (nessun errore silenzioso) |
| macOS: in una cartella con `CLAUDE.md` symlink ad `AGENTS.md`, aprire `CLAUDE.md` e modificare `AGENTS.md` da fuori | la modifica arriva al `CLAUDE.md` aperto (richiesta di ricarica) |
| Windows: nell'albero, "Sposta nel cestino" su un file e confermare | toast «… spostato nel cestino»; il file è nel Cestino di Windows, non cancellato |

### Mai perdere dati

| Cosa fare | Cosa deve succedere |
|---|---|
| Chiudere una scheda con modifiche non salvate | richiesta di salvataggio |
| Chiudere la finestra con modifiche non salvate | richiesta di salvataggio |
| Uscire dall'app con modifiche non salvate | richiesta di salvataggio |

### Esportazione, stampa e copia

| Cosa fare | Cosa deve succedere |
|---|---|
| File ▸ Stampa… (Mod+P) → salva come PDF | si apre il dialogo di stampa; il PDF salvato si apre ed è corretto |
| Esporta in HTML | il file si apre nel browser; `<html lang>` è la lingua dell'interfaccia |
| Copia come HTML, incollare in un editor ricco | la formattazione resta |
| Copia come Markdown, incollare | arriva il Markdown grezzo |

### Vista di lettura e resa

| Cosa fare | Cosa deve succedere |
|---|---|
| In vista di lettura, clic su un link web (`https://…`) | si apre nel browser di sistema; l'app non naviga via |
| In vista di lettura, clic su un link relativo a un `.md` | il file si apre in una nuova scheda |
| Documento con un elenco puntato e uno numerato | i marcatori delle liste si vedono correttamente |
| Documento con un blocco Mermaid, all'apertura | mentre carica compare «Generazione del diagramma…» / "Rendering diagram…", poi il diagramma, senza sfarfallio |

### Cerca e sostituisci, ricerca, palette

| Cosa fare | Cosa deve succedere |
|---|---|
| Trova: cercare una parola, Successivo/Precedente | le occorrenze sono evidenziate e si scorrono |
| Sostituisci (singolo) | cambia solo l'occorrenza corrente |
| Sostituisci tutto | cambia ogni occorrenza |
| Ricerca nella cartella | trova risultati in più file |
| Aprire la palette dei comandi con la sua scorciatoia, eseguire un comando | il comando parte |

### Menu nativo, impostazioni, temi

| Cosa fare | Cosa deve succedere |
|---|---|
| Provare ogni voce dei menu (File, Modifica, Vista, Trova, Esporta, Impostazioni, Aiuto) | ogni voce fa la sua azione |
| Cambiare lingua it ↔ en | i menu si rietichettano subito |
| Cambiare tema / accento / font | si applicano subito, in chiaro e in scuro |
| Ripristina predefiniti | chiede conferma, poi ripristina |
| Impostazioni → «Apri cartella temi» / "Open themes folder" | si apre la cartella temi nel file manager di sistema |
| Impostazioni → note di terze parti | le note incluse si vedono |

### Aggiornamenti

| Cosa fare | Cosa deve succedere |
|---|---|
| Offline: «Controlla aggiornamenti…» | messaggio «Controllo aggiornamenti fallito: …» / "Update check failed: …"; nessun crash |
| Online, con la release 1.0.0 pubblicata e la 1.0.0 installata | «Hai già l'ultima versione» / "You're on the latest version" |
| Prova dell'updater vera (dopo la 1.0: installare la 1.0.0 e pubblicare una 1.0.1 di prova, oppure una pre-release) | propone l'aggiornamento, scarica, chiede dei documenti non salvati, installa; dopo il riavvio la versione è nuova. Se la firma non torna, l'aggiornamento è rifiutato: chiave pubblica e privata non corrispondono |

### Accessibilità, giro rapido

| Cosa fare | Cosa deve succedere |
|---|---|
| Solo tastiera: aprire, modificare, salvare, cercare, palette, menu | tutto si raggiunge e si usa |
| Tab attraverso l'interfaccia | il focus è sempre visibile |
| Ripetere un giro in it e uno in en | l'interfaccia è corretta in entrambe le lingue |
