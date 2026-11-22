# Asterisco pubblico — progetto

Data: 2026-11-20 · Stato: approvato dal proprietario il 2026-11-20 · Autore: sessione di coordinamento

> Il nome di lavoro del progetto (Smeargle, `project-smeargle`) compare qui di proposito:
> è l'oggetto della pulizia descritta.

## Perché

Il repository `fabioshepherd/asterisco` è privato: i pacchetti di una release in un
repository privato non si scaricano senza autenticazione, e l'updater
(`https://github.com/fabioshepherd/asterisco/releases/latest/download/latest.json`)
riceverebbe 404. La 1.0 deve uscire da un repository **pubblico**.

Il proprietario (2026-11-20) vuole cogliere l'occasione per:
- ripartire da un **repository nuovo, con poca storia**;
- **ripulire nomi vecchi e documenti**, e valutare il codice;
- impostarlo **come un progetto open source moderno**, pronto ad accogliere
  contributi «che non si sa mai».

## Decisioni del proprietario (2026-11-20)

1. Repository nuovo e pubblico, con poca storia (la storia completa resta nel vecchio,
   privato).
2. **Tutto pubblico**, documenti di lavoro compresi (regia, decisioni, revisioni,
   piani) — **ma solo dopo averli ripuliti e aggiornati tutti**, anche quelli storici.
3. Contatto per le segnalazioni: **solo GitHub** (segnalazione privata delle
   vulnerabilità; il codice di condotta rimanda al profilo del proprietario). Nessuna
   email nei file.
4. Strada **A**: si pulisce sul repository attuale con PR e CI, poi si trasferisce
   l'albero pulito nel nuovo con un solo commit.
5. La data della 1.0 è il giorno del tag (decisione già registrata).

## Obiettivi

- Un repository pubblico `fabioshepherd/asterisco` che parte da **un solo commit**
  con l'albero ripulito di `main`, e su cui si fa il tag `app-v1.0.0`.
- Nessun riferimento a «smeargle»/«project-smeargle» nel codice e nei documenti.
- Ogni documento del repository corretto e attuale alla data della pubblicazione.
- Impostazione open source (sezione «Impostazione open source»).

## Non obiettivi

- Refactoring del codice: la revisione (2026-11-20) dice che non serve.
- Nuove funzioni, nuove dipendenze dell'app, cambi di architettura.
- Firma macOS/Windows (resta rimandata, decisione 2026-08-17).
- Traduzione dei documenti italiani in inglese (vedi «Scelte della regia»).

## Da evitare (sarebbe un fallimento anche se «funziona»)

- Dati personali nel repository pubblico: la email personale del proprietario come
  autore del commit iniziale, percorsi di casa, dettagli della rete domestica.
- Segreti nel repository o nei log della CI.
- Un repository pubblico con documenti che dicono cose non più vere (link rotti a
  file spariti, stati di avanzamento vecchi, il nome vecchio).
- Perdere la storia: il vecchio repository **non si cancella**.
- Rompere l'updater: l'endpoint deve restare `fabioshepherd/asterisco`.

## Strade considerate

- **A. Pulire qui, poi trasferire** (scelta). Le pulizie passano da PR e CI nel
  repository che conosciamo; il nuovo nasce pulito. Contro: le Actions nuove (CodeQL,
  Scorecard) si vedono girare davvero solo nel nuovo.
- B. Repository nuovo subito, pulizia lì. Scartata: il primo commit conterrebbe
  ancora nomi vecchi e documenti da sistemare; niente protezione di `main` finché è
  privato.
- C. Stesso repository con storia riscritta. Scartata: force-push distruttivo su
  `main`; il proprietario ha chiesto un repository nuovo.

## Il lavoro

### Fase 1 — tre fette sul repository attuale (privato)

File disgiunti, quindi possono andare **in parallelo**, ognuna sul suo ramo con PR
in bozza, controlli locali e CI come da `docs/regia.md`. Partono da `origin/main`.

**F1. Codice** (ramo `public/code`) — dal rapporto di revisione:
- rinominare ogni `smeargle` nel codice e nei test, senza migrazione (nessuna
  installazione da preservare: identifier nuovo `it.fabiopastore.asterisco`):
  4 chiavi `localStorage` (`public/theme-init.js`, `src/stores/settings.ts`,
  `src/features/themes/{accents,neutrals}.ts`), 3 chiavi plugin ProseMirror, l'id
  `smeargle-user-theme`, le cartelle temporanee dei test Rust, i dati di prova di
  `src/test/bump-version.test.ts`. Prefisso nuovo: `asterisco`.
- cancellare `src/lib/dev-hooks.ts` (`window.__smeargle`, codice morto) e i suoi
  agganci;
- correggere i commenti nel codice che rimandano a documenti spostati o rinominati
  (`e2e/a11y.spec.ts:9`, `playwright.config.ts:11`, `AppMark.tsx`,
  `app-mark-motion.ts`, `app-mark.css`, `src-tauri/src/commands/fs.rs:278`,
  `src/lib/tauri/fs.ts:56`) — in coordinamento con F2 sui percorsi finali;
- `scripts/consolidation-metrics.mjs`: tenerlo solo se ancora utile e funzionante
  col nome nuovo, altrimenti toglierlo (resta nella storia del vecchio repository).
- Esclusi: file in `.github/` (vanno a F3), file `.md` (vanno a F2).

**F2. Documenti** (ramo `public/docs`) — tutti i `.md` e i materiali in `docs/`,
tranne `CONTRIBUTING.md` e `SECURITY.md` (vanno a F3):
- ogni documento, **storici compresi** (`docs/consolidation/**`,
  `docs/revisione/**`, voci passate del `CHANGELOG.md`, `docs/naming.md`,
  `docs/superpowers/**`, `docs/brand/**`):
  - nome vecchio → Asterisco, salvo dove serve a capire la storia («prima si
    chiamava Smeargle», una volta, in `docs/naming.md` e nel `CHANGELOG`);
  - niente dati personali;
  - link a file spariti corretti o tolti; stati di avanzamento vecchi segnati come
    chiusi o aggiornati;
  - riferimenti al repository privato, al budget della CI privata, al runner
    self-hosted, alla regola «main non protetto» aggiornati alla situazione
    pubblica.
- riscrivere `CLAUDE.md` perché valga per chiunque contribuisca con un agente (non
  regole personali del proprietario, come «rispondi in italiano», che vanno in
  `CLAUDE.local.md`, ignorato da git); `ARCHITECTURE.md` e `CONTRIBUTING.md` lo
  citano. **Serve il consenso esplicito del proprietario per toccare `CLAUDE.md`.**
- aggiornare `docs/ROADMAP.md`, `docs/release-1.0.md` (nuovo ordine dei passi:
  repository pubblico prima del tag), `docs/RELEASING.md`, `docs/regia.md`
  (repository pubblico, protezione vera di `main`);
- far entrare il passaggio di consegne del ramo `docs/handoff-1.0`
  (`docs/consolidation/handoff.md`) ripulito;
- i documenti del sito (`docs/superpowers/plans/2026-11-20-site.md`,
  `docs/superpowers/specs/2026-11-20-site-design.md`) si spostano nel repository del
  sito `fabioshepherd/asterisco-site`, dove sono nati: qui si tolgono. (I rami
  `docs/site-design` e `claude/site-copy-*` restano nel vecchio repository.)
- `.claude/settings.json`: valutare il contenuto; se sono permessi personali, va
  tolto e `.claude/` (tranne eventuali file di progetto voluti) va nel `.gitignore`.
- `docs/brand/concept/` (99 svg): tenere solo se servono a capire il logo,
  altrimenti togliere.
- questo progetto stesso entra come `docs/superpowers/specs/2026-11-20-public-repo-design.md`.

**F3. Impostazione open source nei file** (ramo `public/oss`) — tutto in
`.github/` più `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
**Serve il consenso esplicito del proprietario per modificare i workflow.**
- `CODE_OF_CONDUCT.md`: Contributor Covenant, versione attuale; contatto = profilo
  GitHub del proprietario.
- `SECURITY.md`: segnalazione privata delle vulnerabilità di GitHub, versioni
  supportate (1.x), nessuna email.
- `CONTRIBUTING.md`: aggiornato (come si prova in locale, Conventional Commits, PR,
  i18n it+en, niente dipendenze copyleft); niente CLA.
- moduli per le issue (`.github/ISSUE_TEMPLATE/` bug + proposta + `config.yml`),
  modello di PR, `CODEOWNERS` (il proprietario).
- `.github/dependabot.yml`: aggiornamenti per bun/npm, Cargo, GitHub Actions,
  raggruppati e settimanali.
- workflow nuovi: CodeQL (JavaScript/TypeScript; Rust se supportato dalla versione
  attuale), OpenSSF Scorecard (con badge nel README).
- workflow esistenti: Actions fissate per SHA, `permissions` minimi per job;
  `release.yml` con attestazioni di provenienza dei pacchetti
  (`actions/attest-build-provenance` o equivalente attuale).
- il commento in `manual-suite.yml:10` che rimanda a documenti spostati.
- leggere prima la documentazione attuale di GitHub per ogni pezzo.

Dopo le tre fette: revisione esperta di sola lettura sull'insieme (sicurezza e
privacy; IPC e Rust per F1; documenti), smoke test del proprietario con
`bun tauri dev` (F1 cambia le chiavi delle impostazioni), unione su `main` al suo
«unisci», una PR alla volta con il ramo aggiornato.

### Fase 2 — trasferimento (azioni del proprietario, con la regia)

1. Controllo finale su `main`: nessun `smeargle` fuori dalle righe storiche volute,
   nessun dato personale, CI verde.
2. Il proprietario rinomina `fabioshepherd/asterisco` → `fabioshepherd/asterisco-archivio`
   (resta privato; non si cancella).
   **Congelamento:** dal controllo finale al push del commit iniziale nel vecchio
   repository non si unisce più niente. I rami non uniti (`develop`,
   `claude/riadattamento-*`, i rami del sito) restano nell'archivio.
3. Il proprietario attiva nel suo account GitHub «Keep my email addresses private» e
   «Block command line pushes that expose my email»; i checkout del nuovo
   repository usano come `user.email` l'indirizzo noreply di GitHub. Così né il
   commit iniziale né i successivi (PR, cambio di versione, tag) pubblicano la email
   personale.
4. Si crea `fabioshepherd/asterisco`, vuoto. Un solo commit con l'albero di `main`
   (senza storia), messaggio `chore: Asterisco 1.0 source` o simile, autore
   noreply; push su `main` del nuovo. Lo prepara la regia, lo spinge con l'ok del
   proprietario.
5. **Il repository diventa pubblico subito dopo il push.** Su un repository privato
   personale CodeQL, la protezione dei segreti, la segnalazione privata delle
   vulnerabilità, le attestazioni e la pubblicazione di Scorecard non sono
   disponibili (o richiedono piani a pagamento), e nemmeno il ruleset su `main`:
   provarli da privato non serve. Il contenuto è lo stesso di `main`, già verificato
   con CI verde e revisione; solo il proprietario può scrivere.
6. Configurazione del nuovo (proprietario, con la guida della regia), subito dopo:
   ruleset su `main` (solo PR, controlli `frontend`, `e2e`, `rust`, `bundle`
   obbligatori, niente force-push); segreto `TAURI_SIGNING_PRIVATE_KEY` (stessa
   chiave di oggi); descrizione, argomenti, sito; Issues sì, Discussions no, Wiki
   no; rami cancellati dopo l'unione; segnalazione privata delle vulnerabilità;
   scansione dei segreti con blocco del push; Dependabot; app GitHub di Claude.
7. Prova della CI sul nuovo con una PR banale (tutti i job verdi, CodeQL e Scorecard
   compresi). Se qualcosa non va, si corregge con una PR.
8. Le sessioni e `docs/regia.md` da qui in poi puntano al nuovo repository; il
   vecchio è solo archivio.

### Fase 3 — 1.0 nel nuovo repository

Il giorno del tag, come già deciso: cambio di versione con PR → tag `app-v1.0.0` con
l'ok del proprietario → release in bozza → prova sui dispositivi → pubblicazione.
Il sito va online con la 1.0 (repository del sito, a parte).

## Chiarimenti

- **Dati personali** = email personale, percorsi di casa, rete domestica. Il nome del
  proprietario in `LICENSE`, nell'identifier `it.fabiopastore.asterisco` e come
  autore è voluto. Le email di terzi in `THIRD-PARTY-NOTICES` sono testi di licenza
  e restano.
- **Nessuna installazione da preservare:** le release 0.x pubblicate erano prove del
  proprietario, non distribuite (proprietario, 2026-11-20). La chiave dell'updater è
  la stessa (id `7E06AE5B898C6E12`).
- **Consensi:** con l'approvazione di questo progetto il proprietario autorizza
  esplicitamente la riscrittura di `CLAUDE.md` (F2) e le modifiche ai workflow
  descritte in F3 — solo quelle.

## Scelte della regia (correggibili)

- Prefisso nuovo delle chiavi interne: `asterisco` (es. `asterisco.theme`).
- I documenti restano nella lingua in cui sono (italiano o inglese): tradurli non è
  stato chiesto. Le regole del codice (commenti e commit in inglese) non cambiano.
- Niente CLA, niente Discussions, niente bot di rilascio automatico.
- Il commit iniziale con l'indirizzo noreply di GitHub, per non pubblicare la email
  personale.
- I documenti del sito tornano nel repository del sito.
- Le vecchie release (bozze «project-smeargle», `app-v0.4.0` pubblicata) restano nel
  repository archivio: nel nuovo non esistono.

## Lasciato a chi costruisce

- Come raggruppare i commit dentro ogni fetta (Conventional Commits).
- Il testo esatto dei moduli e dei modelli GitHub (da approvare dal proprietario
  quando è visibile agli utenti).
- Se CodeQL copre Rust nella versione attuale.
- Quali svg di `docs/brand/concept/` sono utili.
