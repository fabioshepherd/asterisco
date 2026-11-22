# Regia: come lavorano più sessioni Claude Code

Scopo: tante sessioni in parallelo senza conflitti, senza minuti CI sprecati e
senza decisioni prese alle spalle del proprietario.

È il modo in cui lavora il proprietario del progetto con più sessioni di un agente.
Chi contribuisce dall'esterno segue `CONTRIBUTING.md`; le regole su CI, PR e merge
valgono comunque per tutti.

## Ruoli

- **Regia**: una sessione che **non scrive codice**. Divide il lavoro in fette,
  scrive i brief, raccoglie i resoconti, porta le decisioni al proprietario
  tutte insieme e archivia le sessioni finite.
- **Sessioni di lavoro**: una fetta ciascuna, su un proprio ramo.
- **Proprietario**: decide, approva i testi per l'utente, preme Merge su `main`.

## Brief di ogni sessione (autosufficiente)

Ogni brief contiene:

1. **Obiettivo** in 1–3 frasi e cosa NON fare.
2. **Documenti da leggere, per nome** (es. `PRODUCT.md`, `docs/ROADMAP.md`,
   `DESIGN.md`, il file di decisioni dell'ondata).
3. **Decisioni già prese, con data** (es. "2026-11-18: tolto X, approvato").
4. **Ramo di partenza e ramo di arrivo** (es. da `origin/main` a `wave-2/tabs`).
5. **Revisori esperti** solo per le aree toccate (sicurezza e privacy; IPC e Rust;
   app e accessibilità).
6. **Resoconto breve** a fine lavoro via `send_message` alla regia: ramo, SHA,
   cosa è fatto, cosa resta, decisioni aperte (max ~20 righe).

## Parallelo o in fila

- Le sessioni che toccano gli **stessi file condivisi** lavorano **in fila**,
  una dopo l'altra:
  contratto IPC (`src-tauri/src/commands/**`, `src/lib/tauri/**`),
  migrazioni delle impostazioni (`src/stores/settings.ts`,
  `src/lib/tauri/settings-store.ts`), progetto app (`tauri.conf.json`,
  `capabilities/**`, `Cargo.toml`/`Cargo.lock`, `package.json`/`bun.lock`,
  `src/i18n/locales/**`, token di tema), workflow (`.github/workflows/**`).
- Le sessioni **di sola lettura** (revisioni, misure, audit) vanno **in parallelo**.

## Controlli e CI

- Sui rami di lavoro, **prima di ogni commit**, controlli locali obbligatori:
  `bun run typecheck`, `bun run lint`, `bun run test` e, se cambia Rust, il comando
  Rust del `CLAUDE.md`. La CI gira sulla PR.
- **Push solo a fine lavoro** (o a fine fetta), non a ogni commit. **Mai lo stesso
  commit su più rami**: ogni ramo con PR fa ripartire la CI.
- Le PR si aprono **in bozza** (draft). Si segnano "Ready for review" solo quando
  la fetta è finita: così il job lungo `bundle` gira una volta sola.
- Le run superate sulla stessa PR si cancellano da sole; quelle su `main` no.
  Il job `rust` gira sulle PR solo se cambiano `src-tauri/` o i workflow.
- Le PR di sola documentazione (`.md` nella radice, `.md` e immagini in `docs/`, `THIRD-PARTY-NOTICES`) saltano `frontend`, `e2e`, `rust` e `bundle`.
- Dopo un push, **controllare l'esito della CI ogni 10–15 minuti** finché non è
  finita. I promemoria che una sessione si programma da sola possono non partire
  (la sessione è occupata, chiusa o scaduta; i limiti d'uso possono rimandarli):
  per questo **la regia controlla comunque** le PR aperte quando riceve un
  resoconto e prima di ogni giro di decisioni.

## Decisioni

- Le decisioni del proprietario si scrivono **subito**, con la data, nel file di
  decisioni del lavoro in corso (come i `docs/consolidation/w*-decisions.md` della
  consolidazione o `docs/release-1.0.md`).
- Ogni testo visibile all'utente (it + en) scritto da una sessione è marcato
  **"da approvare"** finché il proprietario non lo approva.
- La regia porta le domande al proprietario **tutte insieme**, ognuna con 2–3
  opzioni, pro e contro e una raccomandazione.

## Merge su `main`

Si unisce su `main` **solo** da una PR con CI verde (`frontend`, `e2e`, `rust`,
`bundle`), e a premere **Merge** è il proprietario. Un job saltato per regola
(`rust` senza modifiche Rust, `bundle` su una PR in bozza) risulta verde. Niente
push diretti su `main`.

Sul repository pubblico la regola è anche un **blocco tecnico**: un ruleset su
`main` accetta solo PR, con i controlli `frontend`, `e2e`, `rust` e `bundle`
obbligatori e senza force-push. (Finché il repository era privato su GitHub Free
era solo una regola scritta: decisione D1 = C, proprietario, 2026-11-18, in
`docs/revisione/ci.md`.)

Prima del merge:

1. **Revisione esperta completa, sola lettura**: sicurezza e privacy, IPC e Rust,
   app e accessibilità. (Database e API non si applicano: app desktop local-first.)
2. **Merge di prova** del ramo su `origin/main` aggiornato, senza conflitti; se
   `main` è andato avanti, aggiornare il ramo e far ripartire la CI.
3. **Una sola lista di prove sul dispositivo**, in due colonne:
   "cosa fare" / "cosa deve succedere" (menu nativi, dialoghi, cestino,
   salvataggio, tema, lingua, aggiornamento).
4. Per un'ondata grossa o prima di un tag: la suite manuale
   (workflow `Manual suite`, `workflow_dispatch`). Oggi c'è solo l'area
   `e2e-ambiente`. Le aree bundle (Windows, macOS) e `tutto` non si aggiungono
   per la 1.0: Windows e macOS si provano con la release vera, in bozza
   (decisione del proprietario, 2026-11-19).

## Minuti di CI

Sul repository pubblico i job sui runner standard di GitHub non consumano minuti
a pagamento. Il limite di spesa con avvisi impostato dal proprietario sull'account
(decisione D2 = B, 2026-11-18) resta come rete di sicurezza.
Il job lungo `bundle` gira comunque una volta sola per PR (PR in bozza fino alla
fine della fetta): è tempo di attesa, oltre che di minuti. Se la CI non parte,
la regia lo dice al proprietario: non si aggirano i controlli.

## Limiti d'uso

Prima di un lavoro grosso (molte sessioni in parallelo), la regia avvisa il
proprietario dei limiti d'uso del piano Claude (finestra di 5 ore e limite
settimanale). Le sessioni cloud li condividono con tutto il resto dell'uso
dell'account. Consumo attuale: `/usage` o `claude.ai/settings/usage`.

## Chiusura

A fine fetta la regia controlla il resoconto, verifica la CI della PR e archivia
la sessione.
