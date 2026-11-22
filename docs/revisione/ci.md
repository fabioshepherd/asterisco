# Revisione CI (GitHub Actions) e regole per più sessioni

> **Documento storico** (2026-11-18), scritto quando il repository era ancora privato,
> su GitHub Free e con il nome di lavoro; oggi è l'archivio privato del progetto. Dal
> 2026-11-20 il progetto vive in un repository **pubblico**: `main` è protetto da un
> ruleset (solo PR, controlli `frontend`, `e2e`, `rust`, `bundle` obbligatori, niente
> force-push) e i job sui runner standard di GitHub non consumano minuti a pagamento.
> Le misure, i costi e le decisioni D1–D7 qui sotto descrivono la situazione di allora;
> le regole in vigore sono in `docs/regia.md` e nei workflow.

Data: 2026-11-18. Ramo: `consolidation/ci-review`. Documento di sola analisi: **nessun workflow e nessun file del prodotto è stato modificato**. Gli esempi YAML qui sotto sono proposte da approvare, non modifiche applicate.

> **Stato al 2026-11-18**: il proprietario ha deciso D1–D7 e approvato P1, P2, P3, P5, P6, P7, P9, P11 e la Parte 3 (P4 non approvata). Le proposte approvate sono applicate sul ramo `ci-apply` (un commit per modifica); ogni sezione qui sotto lo indica con **Stato**. I workflow sono la fonte di verità: dove differiscono dagli esempi YAML di questo documento, vale il workflow.

## In breve

- **Spesa reale finora: poca.** In tutta la storia del repository (31 maggio – 18 novembre 2026: 80 run, 160 job) i job hanno usato 915 minuti Linux, 199 Windows e 52 macOS: circa **10,70 USD** ai prezzi attuali. Il mese peggiore (giugno) vale circa 5,53 USD; i piani GitHub Free e Pro includono 12 e 18 USD al mese.
- **Il problema più grande è stato un job bloccato per 6 ore.** Il 19 agosto il job `rust` si è fermato su `apt-get install` ed è andato avanti per 362 minuti, perché nessun job ha `timeout-minutes` (il valore predefinito è 360). Da solo vale il 47% della spesa di agosto.
- **Ad agosto la CI è stata bloccata dalla fatturazione.** Le run del 28 e del 31 agosto non sono partite per il limite di spesa dell'account. La quota è condivisa con tutti i repository privati dell'account, quindi va controllata la pagina Billing.
- **Il repository è privato e su GitHub Free**, e con questo piano GitHub non permette di proteggere `main` (né branch protection né ruleset; l'API risponde "Upgrade to GitHub Pro or make this repository public"). Oggi "merge solo con CI verde" può essere solo una regola scritta. È una decisione per te (D1).
- **Il risparmio più utile non è sui documenti**: le run causate solo da documentazione sono 3 su 80, per 15 minuti in tutto. Conta di più far partire il job `rust` (il più lento) solo quando cambia il codice Rust e far girare `Build check` solo quando la PR è pronta (non in bozza).
- **Non c'è un runner self-hosted**: tutti i job sono girati su runner ospitati da GitHub (`ubuntu-22.04`, `windows-latest`, `macos-latest`).

## Come ho misurato

- **Dati**: tutte le run del repository (80, l'intera storia disponibile) e tutti i loro job (160, compresi i tentativi ripetuti), letti in sola lettura con il server MCP GitHub e con `gh api .../actions/runs/{id}/jobs`. I file cambiati vengono dall'API compare/pull files.
- **Minuti fatturabili**: l'endpoint `timing`/usage restituisce 0 ms per questo repository e la pagina Billing non è raggiungibile dagli strumenti di questa sessione. Per questo ho calcolato `completed_at − started_at` di ogni job, **arrotondato per eccesso al minuto per job**, come scrive GitHub ("GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute", [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing), consultato il 2026-11-18).
- **Prezzi** (dalla stessa pagina e da [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), consultato il 2026-11-18): Linux 2-core 0,006 USD/min, Windows 2-core 0,010 USD/min, macOS 0,062 USD/min. Oggi GitHub non usa più i "moltiplicatori": la quota inclusa è un importo in dollari (Free 12 USD/mese, Pro 18 USD/mese, Team 18 USD/mese), da cui si scala il costo di ogni minuto. I prezzi sono applicati anche ai mesi passati, quindi i costi storici sono una **stima ai prezzi di oggi**.
- **Piano dell'account**: `get_me` non mostra il piano. L'API di branch protection risponde "Upgrade to GitHub Pro", quindi il proprietario è con ogni probabilità su **GitHub Free** (ipotesi). Le stime sotto valgono per Free e, dove indicato, per Pro.
- **Limiti**: la sessione non può leggere la cache di Actions (`/actions/caches`) né la lista dei runner (`/actions/runners`), perché il proxy blocca quei percorsi. Gli artifact invece sono leggibili.

## Parte 1 — Misure

### Workflow attuali

| File                                | Nome        | Quando parte                                         | Job (nome del check)                           | Runner               | `timeout-minutes` | `concurrency` |
| ----------------------------------- | ----------- | ---------------------------------------------------- | ---------------------------------------------- | -------------------- | ----------------- | ------------- |
| `.github/workflows/ci.yml`          | CI          | `push` su `main`, `pull_request` (qualsiasi base)    | `frontend`, `e2e`, `rust`                      | ubuntu-22.04         | no                | no            |
| `.github/workflows/build-check.yml` | Build check | `pull_request` (qualsiasi base), `workflow_dispatch` | `bundle`                                       | ubuntu-22.04         | no                | no            |
| `.github/workflows/release.yml`     | Release     | tag `app-v*`, `workflow_dispatch`                    | `release` (matrice: windows, ubuntu, 2× macOS) | windows/ubuntu/macOS | no                | no            |

Nessuno dei 5 job ha `timeout-minutes`, quindi vale il default di 360 minuti ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), `jobs.<job_id>.timeout-minutes`, consultato il 2026-11-18).

### Minuti e costo stimato per mese

| Mese                |                     Linux | Windows |  macOS |       Costo stimato (USD) | % della quota Free (12 USD) |
| ------------------- | ------------------------: | ------: | -----: | ------------------------: | --------------------------: |
| 2026-05 (solo 31/5) |                         8 |       0 |      0 |                      0,05 |                        0,4% |
| 2026-06             |                       287 |     151 |     37 |                      5,53 |                         46% |
| 2026-07             |                         0 |       0 |      0 |                         0 |                          0% |
| 2026-08             | 536 (di cui 362 bloccati) |      48 |     15 | 4,63 (2,17 per il blocco) |                         39% |
| 2026-09 / 10        |                         0 |       0 |      0 |                         0 |                          0% |
| 2026-11 (17–18/11)  |                        84 |       0 |      0 |                      0,50 |                          4% |
| **Totale**          |                   **915** | **199** | **52** |                 **10,70** |                           — |

### Per workflow (intera storia)

| Workflow    | Linux | Windows | macOS | Costo (USD) | Note                                                                       |
| ----------- | ----: | ------: | ----: | ----------: | -------------------------------------------------------------------------- |
| CI          |   759 |       0 |     0 |        4,55 | `rust` 591 min (362 nel blocco), `frontend` 158, `e2e` 10 (esiste da poco) |
| Build check |    98 |       0 |     0 |        0,59 | ~10 min a run, 10 run                                                      |
| Release     |    58 |     199 |    52 |        5,57 | 8 run su tag; **macOS costa ~10 volte Linux al minuto**                    |

Una release completa a 4 piattaforme (es. `app-v0.5.1`) costa circa **1,27 USD**: per il 73% sono i due job macOS.

### Ultimi 30 giorni (19 ottobre – 18 novembre 2026)

| Giorno               | Workflow                                                   | Linux min |                    Costo (USD) |
| -------------------- | ---------------------------------------------------------- | --------: | -----------------------------: |
| 2026-11-17           | CI 18 + Build check 9 (PR #8) + CI 13 (merge su `main`)    |        36 |                           0,22 |
| 2026-11-18           | CI 9+11 e Build check 6+11 (PR #9, 2 push) + CI 11 (merge) |        48 |                           0,29 |
| **Totale 30 giorni** | 8 run                                                      |    **84** | **0,50** (4% della quota Free) |

Prima del 17 novembre non ci sono run dal 31 agosto.

### Stima mensile per i prossimi mesi (ipotesi)

Una PR tipica oggi costa: CI ~10 min + Build check ~9 min per ogni push sulla PR, più CI ~11 min al merge su `main`. Una PR con 2 push vale circa 49 min Linux (~0,29 USD).

| Scenario (ipotesi)                         | Minuti Linux/mese | Release | Costo/mese | Free (12 USD)      | Pro (18 USD) |
| ------------------------------------------ | ----------------: | ------- | ---------: | ------------------ | ------------ |
| Calmo: 10 PR, 2 push l'una                 |              ~490 | 1       |   ~4,2 USD | 35%                | 23%          |
| Attivo: 20 PR, 2 push                      |              ~980 | 2       |   ~8,4 USD | 70%                | 47%          |
| Molte sessioni in parallelo: 60 PR, 3 push |            ~4.100 | 2       |    ~27 USD | **oltre** (blocco) | **oltre**    |

Con il ritmo multi-sessione la quota si esaurisce. Su Free senza metodo di pagamento, a quel punto GitHub blocca tutte le run fino al mese successivo ("If your account does not have a valid payment method on file, usage is blocked once you consume the included compute usage", [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), consultato il 2026-11-18). È quello che si è visto ad agosto.

### Sprechi misurati

| Spreco                                                                             | Run |                                                                Minuti | % del totale (1.166 min) | Cosa lo evita                                                                                           |
| ---------------------------------------------------------------------------------- | --: | --------------------------------------------------------------------: | -----------------------: | ------------------------------------------------------------------------------------------------------- |
| Job `rust` bloccato 6 ore (`apt-get install`, run 32279410518, 19/08)              |   1 |                                                                   362 |                      31% | `timeout-minutes` (P1); con `concurrency` sarebbe stato cancellato 55 min dopo, al push successivo (P2) |
| Job `rust` partito senza modifiche in `src-tauri/` o nei workflow (blocco escluso) |  35 |                                                                    88 |                       8% | job `rust` condizionato (P3)                                                                            |
| Run causate solo da documenti (`*.md` in root, `docs/**`)                          |   3 |                                                                    15 |                     1,3% | filtro documenti (P4)                                                                                   |
| Run su `main` superate da un altro push entro 10 minuti                            |   9 | 51 (al massimo; solo la parte ancora in corsa si sarebbe risparmiata) |                      ≤4% | su `main` è meglio **non** cancellare (P2)                                                              |
| Run di PR superate entro 10 minuti                                                 |   0 |                                                                     0 |                       0% | —                                                                                                       |
| Run fallite in 4 secondi per il blocco billing (28 e 31 agosto)                    |   7 |                                                                   0–1 |                       0% | budget e avvisi (P12)                                                                                   |

Dettagli utili:

- Su 62 run di CI, solo **26** toccavano `src-tauri/` o `.github/workflows/ci.yml`: nelle altre 36 il job `rust` ha girato senza motivo.
- I 3 commit solo-documenti sono `docs(export)` del 8/6 (2 commit) e `docs(backlog)` del 14/6, tutti push diretti su `main`.
- Attenzione: **`e2e/fixtures/*.md` sono file di test**. Un filtro generico `**.md` salterebbe test che servono. Il filtro deve elencare solo `*.md` in root e `docs/**`.
- `src-tauri/THIRD-PARTY-NOTICES.txt` è una risorsa impacchettata nell'app (`tauri.conf.json` → `bundle.resources`), quindi **non** va filtrata. `THIRD-PARTY-NOTICES` in root non è usato dalla build.
- Oggi nessun job controlla che i NOTICES rigenerati siano aggiornati (lo fa solo `release.yml`, e con `|| echo ... skipped`) e nessuno controlla che `bun.lock` sia allineato (`bun install` senza `--frozen-lockfile`). Vedi P8.

### Run per tipo di ramo

| Evento                                                           | Run | Minuti                      | Note                                                                          |
| ---------------------------------------------------------------- | --: | --------------------------- | ----------------------------------------------------------------------------- |
| `pull_request` da rami di lavoro (`claude/*`, `consolidation/*`) |  21 | 558 Linux (362 del blocco)  | tutte verso `main` (PR #1–#9)                                                 |
| `push` su `main`                                                 |  51 | 299 Linux                   | a giugno quasi tutti push diretti senza PR; da agosto soprattutto merge di PR |
| `push` di tag `app-v*` (Release)                                 |   8 | 58 Linux, 199 Win, 52 macOS |                                                                               |
| `push` su rami di lavoro                                         |   0 | 0                           | la CI già oggi non parte sui push ai rami di lavoro                           |

### Artifact e storage

- **Artifact presenti: 0** (l'API restituisce `total_count: 0`). L'unico upload è `playwright-report`, solo quando `e2e` fallisce, senza `retention-days`: resterebbe 90 giorni, il default ([Managing GitHub Actions settings for a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository), consultato il 2026-11-18). Storage incluso: Free 500 MB, Pro 1 GB, condivisi con GitHub Packages.
- **Cache**: non leggibile da questa sessione. `Swatinem/rust-cache` salva la cache anche dalle PR (passo "Post Run" di ~67 s nell'ultima run). La cache ha un limite separato di 10 GB per repository e le voci non usate da 7 giorni vengono rimosse ([Dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching), consultato il 2026-11-18).
- Gli asset delle Release (es. 111 MB per `app-v0.5.1`) sono file delle Release, non artifact di Actions.
- Dal 1° ottobre 2026 la retention del repository vale anche per check, run e commit status, non solo per artifact e log (stessa pagina). La storia delle run usata qui potrà quindi sparire dopo il periodo impostato.

### Job senza `timeout-minutes`

Tutti: `frontend`, `e2e`, `rust` (CI), `bundle` (Build check), `release` (Release, 4 varianti). Durate massime osservate: `frontend` 4 min, `e2e` 2, `rust` 9 (senza il blocco), `bundle` 15, release Windows 25, Linux 16, macOS 8.

### Runner self-hosted

**Non c'è.** Tutti i 160 job hanno runner `GitHub Actions N` con etichette ospitate. Nessuna run "in progress" senza log, nessuna run persa. I punti su sleep, servizio e auto-update servono solo se in futuro aggiungi un runner self-hosted (P14).

## Parte 2 — Proposte (ordinate per valore/sforzo)

Ogni proposta è **da approvare**. Nessuna richiede strumenti nuovi, salvo dove indicato; in quei casi la scelta è nelle "Decisioni per te".

### P1 — `timeout-minutes` su ogni job (valore alto, sforzo minimo)

- **Stato**: applicata (owner 2026-11-18). Tetti: `frontend` 15, `e2e` 15, `changes` 5, `rust` 30, `bundle` 40, `release` 60, suite manuale 15; passo `apt-get` 10.
- **Cosa**: un tetto per job pari a circa 2–3 volte la durata massima osservata: `frontend` 15, `e2e` 15, `rust` 30, `bundle` 40, `release` 60. In più un tetto sul solo passo `apt-get` (`timeout-minutes: 10`), che è il passo che si è bloccato.
- **Pro**: il blocco del 19 agosto sarebbe costato 30 minuti invece di 362. Nessuno strumento nuovo.
- **Contro**: se un giorno un job diventa davvero più lento, viene cancellato e il tetto va alzato.
- **Fonte**: default 360 min, `jobs.<job_id>.timeout-minutes` e `steps[*].timeout-minutes` ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), consultato il 2026-11-18).

```yaml
jobs:
  rust:
    runs-on: ubuntu-22.04
    timeout-minutes: 30
    steps:
      - name: Install Linux dependencies
        timeout-minutes: 10
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### P2 — `concurrency` per ref, cancellando solo sulle PR (valore alto, sforzo minimo)

- **Stato**: applicata (owner 2026-11-18), con una differenza dall'esempio: fuori dalle PR il gruppo usa `github.run_id` invece di `github.ref` (`${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}`). Con un gruppo condiviso GitHub tiene al massimo una run in attesa e cancella quella prima, quindi più merge ravvicinati lascerebbero commit di `main` senza controllo; così ogni run su `main` parte. `release.yml`: gruppo per tag, mai cancellato.
- **Cosa**: in `ci.yml` e `build-check.yml`, quando arriva un nuovo push sulla stessa PR, la run vecchia si cancella. Su `main` le run non si cancellano: ogni commit di `main` resta verificato. `release.yml` ha un gruppo per tag e non cancella mai.
- **Pro**: con più sessioni che fanno push sulla stessa PR si paga solo l'ultima run. Avrebbe chiuso il job bloccato del 19 agosto dopo 55 minuti invece di 6 ore.
- **Contro**: su una PR non si vede più l'esito della run vecchia, che è stata cancellata. Il nome del gruppo deve includere `github.workflow`, altrimenti CI e Build check si cancellano a vicenda ("concurrency group names must be unique across workflows", [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax); [Control workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), consultati il 2026-11-18).

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

### P3 — Job `rust` solo quando cambia il codice Rust (valore medio-alto, sforzo basso)

- **Stato**: applicata (D3 = A, owner 2026-11-18), senza l'output `code` dell'esempio, che serviva solo a P4 (non approvata). Il ramo di base arriva allo script come variabile d'ambiente.
- **Cosa**: un piccolo job `changes` legge l'elenco dei file cambiati con `git diff`, senza strumenti nuovi. `rust` parte solo se cambiano `src-tauri/**` o `.github/workflows/**`, e sempre su `push` a `main` e su `workflow_dispatch`.
- **Perché così e non con `paths:` sul workflow**: se un workflow viene saltato da un filtro `paths`, i suoi check restano "Pending" e bloccano il merge quando sono obbligatori. Un job saltato da un `if:` invece risulta "Success" ([Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks), consultato il 2026-11-18). Questo approccio funziona sia oggi sia con la protezione di `main` (D1).
- **Pro**: nelle PR solo frontend si risparmiano 3–9 minuti a run. Nella storia: 36 run su 62.
- **Contro**: ~20 righe di YAML in più. Su `main` si fa comunque il giro completo, quindi un errore Rust causato da un file non-Rust (raro: `cargo test` non usa il frontend) verrebbe preso lì.
- **Alternative**: vedi D3 (azione esterna `dorny/paths-filter`, oppure workflow separato con `paths`).

```yaml
jobs:
  changes:
    runs-on: ubuntu-22.04
    timeout-minutes: 5
    outputs:
      rust: ${{ steps.diff.outputs.rust }}
      code: ${{ steps.diff.outputs.code }}
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - id: diff
        run: |
          if [ "${{ github.event_name }}" != "pull_request" ]; then
            echo "rust=true" >> "$GITHUB_OUTPUT"; echo "code=true" >> "$GITHUB_OUTPUT"; exit 0
          fi
          files=$(git diff --name-only "origin/${{ github.base_ref }}...HEAD")
          echo "$files" | grep -qE '^(src-tauri/|\.github/workflows/)' && echo "rust=true" >> "$GITHUB_OUTPUT" || echo "rust=false" >> "$GITHUB_OUTPUT"
          echo "$files" | grep -qvE '^([^/]+\.md|docs/.*|LICENSE|THIRD-PARTY-NOTICES)$' && echo "code=true" >> "$GITHUB_OUTPUT" || echo "code=false" >> "$GITHUB_OUTPUT"
  rust:
    needs: changes
    if: needs.changes.outputs.rust == 'true'
    # ... resto invariato
```

### P4 — Niente CI per le modifiche solo ai documenti (valore basso, sforzo minimo)

- **Stato**: **non approvata** (owner 2026-11-18). Non applicata.
- **Cosa**: con lo stesso job `changes` di P3, `frontend`, `e2e` e `bundle` si saltano quando `code == 'false'`, cioè quando cambiano solo `*.md` in root, `docs/**`, `LICENSE` o `THIRD-PARTY-NOTICES` in root.
- **Perché è sicuro**: `.prettierignore` esclude già `*.md`, quindi `bun run lint` non controlla i documenti, e nessun test o build legge quei file. Restano esclusi dal filtro `e2e/fixtures/*.md` (sono test), `src-tauri/THIRD-PARTY-NOTICES.txt` (è impacchettato), `bun.lock` e `package.json`.
- **Pro**: i documenti di revisione e di regia (come questo) non consumano minuti.
- **Contro**: risparmio piccolo (1,3% della storia). Se un giorno un test leggerà un `.md` della root, il filtro andrà aggiornato.
- **Alternativa più semplice, solo finché `main` non è protetto**: `paths-ignore` sul trigger del workflow ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), `on.<push|pull_request>.<paths|paths-ignore>`, consultato il 2026-11-18). Quando i check diventano obbligatori va tolto, per il problema "Pending" spiegato in P3.

### P5 — `Build check` solo quando la PR è pronta, non in bozza (valore medio, sforzo minimo)

- **Stato**: applicata (D5 = A, owner 2026-11-18).
- **Cosa**: `bundle` (~10 min, il job più lungo) non parte sulle PR in bozza e parte quando la PR passa a "Ready for review" e poi a ogni push.
- **Pro**: le sessioni lavorano su PR in bozza con la sola CI veloce. Il bundle si paga una volta, prima del merge. Una PR in bozza non si può comunque unire, quindi il check saltato (che risulta "Success") non apre una scorciatoia.
- **Contro**: bisogna ricordarsi di aprire le PR come bozza. Se la PR nasce già "pronta", il risparmio non c'è.
- **Fonte**: tipi predefiniti `opened`, `synchronize`, `reopened` ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), consultato il 2026-11-18).

```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_dispatch:
jobs:
  bundle:
    if: github.event_name != 'pull_request' || github.event.pull_request.draft == false
    timeout-minutes: 40
```

### P6 — CI a pagamento solo su PR verso `main`, push su `main` e `workflow_dispatch` (valore basso oggi, sforzo minimo)

- **Stato**: applicata (owner 2026-11-18).
- **Situazione attuale**: è già quasi così. `ci.yml` parte su `push` a `main` e su **ogni** `pull_request`, mentre i push sui rami di lavoro non fanno partire nulla.
- **Cosa cambiare**: aggiungere `branches: [main]` a `pull_request` in `ci.yml` e `build-check.yml`, e `workflow_dispatch` a `ci.yml`, per poterla lanciare a mano su un ramo.
- **Cosa si perde, esattamente**:
  1. Le PR verso rami diversi da `main` (PR "a catena", es. ramo B → ramo A) non avranno CI automatica. Oggi non ce ne sono: tutte le 9 PR puntano a `main`.
  2. Un ramo di lavoro senza PR non ha CI (già oggi è così): gli errori si scoprono solo con i controlli locali o aprendo la PR.
  3. Il controllo del merge su `main` resta (push su `main`), ma arriva **dopo** il merge. Da qui l'importanza di D1.

### P7 — Retention breve per gli artifact pesanti (valore basso, sforzo minimo)

- **Stato**: applicata (owner 2026-11-18): `retention-days: 7` su `playwright-report`. La retention del repository resta un'impostazione da fare a mano, se la vuoi.
- **Cosa**: `retention-days: 7` su `playwright-report`. Opzionale: retention del repository a 30 giorni (Settings → Actions → General).
- **Pro**: un report Playwright con le trace può pesare decine di MB, contro 500 MB inclusi in Free, condivisi con Packages. Lo storage si paga a ore anche dopo la cancellazione ([GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), consultato il 2026-11-18).
- **Contro**: dopo 7 giorni il report di un errore vecchio non c'è più. Con retention a 30 giorni sul repository, dal 1° ottobre 2026 spariscono dopo 30 giorni anche la storia delle run e i check, e quindi misure come questa.
- **Fonte**: [Removing workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts) e [Managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) (privati: da 1 a 400 giorni), consultati il 2026-11-18.

```yaml
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: playwright-report
    path: playwright-report
    retention-days: 7
```

### P8 — Cache e controlli di coerenza, con chiavi corrette (valore medio, sforzo basso)

- **`rust-cache` salvata solo da `main`**: `save-if: ${{ github.ref == 'refs/heads/main' }}`. Le PR leggono la cache di `main` ma non la riscrivono: si risparmia ~1 min a run di PR ("Post Run" ~67 s) e non si riempie il limite di 10 GB con cache di rami ([README di Swatinem/rust-cache](https://github.com/Swatinem/rust-cache#readme), consultato il 2026-11-18). Contro: una PR che cambia `Cargo.lock` ricompila da zero finché non arriva su `main`.
- **Niente cache per i browser di Playwright**: secondo Playwright, ripristinarli costa quanto scaricarli e le dipendenze di sistema Linux non si possono mettere in cache ([Playwright CI — Caching browsers](https://playwright.dev/docs/ci#caching-browsers), sorgente letto su `microsoft/playwright/docs/src/ci.md`, consultato il 2026-11-18). Oggi il passo dura ~35 s: va bene così.
- **Niente cache per `bun install`**: dura 3–4 s, una cache non ripagherebbe.
- **`bun install --frozen-lockfile`** in CI (opzione presente in bun 1.4.4, "Disallow changes to lockfile", verificata con `bun install --help`; il sito bun.com non era raggiungibile da questa sessione). La CI fallisce se `bun.lock` non corrisponde a `package.json`, invece di aggiornarlo in silenzio. Costo zero.
- **Controllo dei NOTICES rigenerati**: oggi `release.yml` rigenera i NOTICES ma, se fallisce, va avanti (`|| true`, `|| echo`). Si potrebbe aggiungere un controllo `bun run notices && git diff --exit-code src-tauri/THIRD-PARTY-NOTICES.txt`, in un job che parte **solo** quando cambiano `bun.lock`, `package.json`, `src-tauri/Cargo.lock` o `src-tauri/about.*`. Il costo è `cargo install cargo-about` (minuti di compilazione), quindi conviene solo con il filtro. Attenzione: è proprio il tipo di controllo che un filtro documenti scritto male salterebbe; con il filtro di P4 non succede, perché i lockfile non sono nell'elenco dei documenti.
- **Versioni delle azioni**: vedi P9.

### P9 — Azioni fissate a un commit SHA (sicurezza, sforzo basso; decisione D4)

- **Stato**: applicata (D4 = B, owner 2026-11-18). SHA risolti con `git ls-remote` sui repository delle azioni: `actions/checkout` v5.1.0, `oven-sh/setup-bun` v2.2.0, `actions/upload-artifact` v4.6.2, `Swatinem/rust-cache` v2.9.3, `tauri-apps/tauri-action` v0.6.2; `dtolnay/rust-toolchain` non pubblica release ed è fissata alla testa del ramo `stable` del 2026-11-18.
- **Cosa**: oggi si usano tag mobili (`@v5`, `@v2`, `@v0.6.2`) e un ramo (`dtolnay/rust-toolchain@stable`). GitHub raccomanda di fissare le azioni a un commit SHA ("Pin references to actions to a commit SHA", [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), consultato il 2026-11-18).
- **Pro**: un tag spostato da un attaccante non cambia la CI, che ha accesso ai segreti di firma in `release.yml`.
- **Contro**: gli aggiornamenti diventano manuali, a meno di attivare Dependabot (funzione di GitHub, ma è comunque un nuovo automatismo che apre PR, e quindi consuma minuti di CI).

### P10 — Permessi minimi del `GITHUB_TOKEN` (sicurezza, sforzo minimo)

- **Cosa**: `permissions: contents: read` in cima a `ci.yml` e `build-check.yml` (`release.yml` ha già `contents: write` sul job). In alternativa, impostazione del repository "Read repository contents and packages permissions".
- **Fonte**: "set the default permission for the GITHUB_TOKEN to read access only for repository contents" ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), consultato il 2026-11-18).
- **Contro**: nessuno per questi workflow. `tauri-action` in Build check non pubblica nulla.

### P11 — Suite lunghe solo a mano, con scelta dell'area (valore medio quando ci si avvicina a una release; decisione D6)

- **Stato**: applicata in parte (D6 = A, owner 2026-11-18): `.github/workflows/manual-suite.yml` con la sola area `e2e-ambiente` (spec in `e2e/environment`, attive solo con `E2E_AREA=environment`, quindi la e2e delle PR non cambia). Le aree `bundle-windows`, `bundle-macos` e `tutto` non sono elencate: una scelta che non esegue nulla risulterebbe verde per controlli mai fatti. Si aggiungono quando si prepara la prossima release.
- **Oggi** l'unica suite "lunga" è `bundle` (~10 min). `e2e` dura ~42 s (10 test) e deve restare su ogni PR. Non ci sono test di screenshot.
- **Proposta**: un nuovo workflow `manual-suite.yml`, solo `workflow_dispatch`, con un input `area` di tipo `choice` ([Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), `on.workflow_dispatch.inputs.<input_id>.type`: `boolean`, `choice`, `number`, `environment`, `string`; consultato il 2026-11-18):
  - `bundle-windows`, `bundle-macos`: build senza pubblicazione su Windows e macOS. Oggi Windows e macOS si provano solo nella release vera, e 3 release su 8 sono fallite. Costo: ~22 min Windows (0,22 USD) e ~13 min macOS (0,81 USD).
  - `e2e-ambiente`: e2e in più varianti con Playwright (lingua `it` ed `en`, tema scuro, `prefers-reduced-motion`, rete spenta).
  - `tutto`: tutte le aree, **da lanciare prima di ogni merge di una "ondata" grossa e prima di ogni tag di release**.
- **Test manuali da automatizzare, e quali contano per questa app**:
  - **Rete assente (offline)**: conta. L'app è local-first e l'unico accesso alla rete è il controllo aggiornamenti, lanciato a mano (`src/features/updates/check-updates.ts`). Test: con la rete spenta (`context.setOffline(true)` / `page.route` che blocca tutto) aprire, modificare e salvare funziona, e **nessuna richiesta esce** dal WebView.
  - **Lingua it/en**: conta (regola "UI strings only via i18n"). Test: stesse schermate nelle due lingue, senza chiavi mancanti.
  - **Tema chiaro/scuro e movimento ridotto**: contano (WCAG 2.2 AA nel CLAUDE.md). Si fanno con l'emulazione dei media di Playwright.
  - **Fusi orari e mezzanotte**: **non contano oggi**. L'app non mostra date: `Date.now()` serve solo all'intervallo di salvataggio automatico (`toggle-auto-save.ts`) e a un nome di file di riserva (`themes-folder.ts`), e non c'è nessun formato data. Da riconsiderare se arrivano funzioni con date (es. "modificato alle…").
  - **Test sul dispositivo vero** (menu nativi, dialoghi di sistema, cestino, firma/notarizzazione, aggiornamento): non si automatizzano in CI con l'IPC simulato. Restano nella lista "cosa fare / cosa deve succedere" della Parte 3.

### P12 — Budget di Actions con stop e avvisi al 90/100% (valore alto, solo impostazioni)

Vedi D2 e i "Passi da fare a mano". Fonte: [Setting up budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets) e [Budgets and alerts](https://docs.github.com/en/billing/concepts/budgets-and-alerts), consultati il 2026-11-18. Per un account personale gli avvisi del budget scattano al 75%, 90% e 100%. Gli avvisi sulla quota inclusa scattano al 90% e al 100%.

### P13 — Protezione di `main`: merge solo da PR con CI verde (valore alto, ma richiede D1)

- **Bloccante**: su un repository privato di un account Free le branch protection e i ruleset non sono disponibili ("Rulesets are available in public repositories with GitHub Free … and in public and private repositories with GitHub Pro, GitHub Team, and GitHub Enterprise Cloud", [Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository); stessa frase in [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), consultati il 2026-11-18). Confermato dall'API su questo repository.
- **Check obbligatori, con i nomi esatti dei job attuali**: `frontend`, `e2e`, `rust` (workflow CI) e `bundle` (workflow Build check). I nomi sono unici fra i workflow, come chiede GitHub ("make sure that job names are unique across all workflows", About protected branches). **Non** rendere obbligatorio `release`: parte solo sui tag.
- **Compatibilità con P3–P5**: i job saltati con `if:` risultano "Success" e non bloccano. Non usare `paths`/`paths-ignore` sul workflow (i check resterebbero "Pending").
- **Approvazioni richieste: 0.** Sei l'unico proprietario e non puoi approvare le tue PR. "Approvata dal proprietario" vuol dire che sei tu a premere **Merge**.
- I passi esatti sono in "Passi da fare a mano".

### P14 — Runner self-hosted (oggi non c'è; decisione D7)

Se un giorno vuoi usare un Mac o un PC di casa per risparmiare i minuti macOS e Windows (i runner self-hosted sono gratuiti: "Self-hosted runners" è nell'elenco dell'uso che "remains free", [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), consultato il 2026-11-18):

- **Come servizio**: `sudo ./svc.sh install` e poi `sudo ./svc.sh start` su Linux/macOS. Su Windows si sceglie "service" durante la configurazione, altrimenti va riconfigurato da capo ([Configuring the self-hosted runner application as a service](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application), consultato il 2026-11-18).
- **Alimentazione**: la macchina non deve andare in sospensione mentre aspetta i job. Se dorme, i job restano in coda o si perdono a metà. (Consiglio generale: va impostato nelle opzioni di risparmio energia del sistema operativo; non è nella documentazione GitHub.)
- **Aggiornamento automatico**: è attivo di default. Se lo disattivi (`--disableupdate`) devi aggiornare entro 63 giorni, altrimenti GitHub non assegna più job ([Self-hosted runners reference](https://docs.github.com/en/actions/reference/runners/self-hosted-runners), consultato il 2026-11-18).
- **Sicurezza con repository privato**: chi può aprire una PR può eseguire codice sulla macchina e arrivare ai segreti e al `GITHUB_TOKEN` ([Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use), consultato il 2026-11-18). Quindi: un utente dedicato senza privilegi, niente dati personali sulla macchina, solo collaboratori fidati e, se possibile, runner effimeri (`--ephemeral`). **Mai** su un repository pubblico.
- **Regola sulle run perse**: una run "in progress" senza log va rilanciata **una volta** ([Re-running workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs), consultato il 2026-11-18). Se si perde di nuovo, si controlla la macchina (acceso? servizio attivo? in sospensione?).

### Riepilogo dell'effetto atteso

| Proposta               | Risparmio tipico                          | Sforzo        | Strumento nuovo? |
| ---------------------- | ----------------------------------------- | ------------- | ---------------- |
| P1 timeout             | evita i blocchi da 6 h (31% della storia) | 5 righe       | no               |
| P2 concurrency         | paga solo l'ultimo push di una PR         | 3 righe       | no               |
| P3 rust condizionato   | 3–9 min su ~60% delle PR                  | ~20 righe     | no (D3)          |
| P5 bundle non in bozza | ~10 min per ogni push in bozza            | 3 righe       | no               |
| P4 documenti           | ~10–20 min per PR di soli documenti       | incluso in P3 | no               |
| P7 retention           | storage (oggi 0)                          | 1 riga        | no               |
| P8 cache/lockfile      | ~1 min per run di PR; meno sorprese       | 2 righe       | no               |
| P9–P10 sicurezza       | —                                         | basso         | D4               |
| P11 suite manuale      | sposta Windows/macOS prima del tag        | 1 file nuovo  | no (D6)          |
| P12 budget             | evita blocchi e spese a sorpresa          | impostazioni  | no               |
| P13 protezione `main`  | evita merge rossi                         | impostazioni  | dipende da D1    |

Con lo scenario "molte sessioni" (60 PR × 3 push, di cui 2 in bozza) e P3+P5 attivi, la stima scende da ~4.100 a circa 2.700 min Linux al mese (~19 USD con 2 release); P2 toglie ancora qualcosa quando i push si accavallano. Resta sopra la quota Free (12 USD) e Pro (18 USD): da qui l'importanza del budget (D2) e della regola "push a fine lavoro" (Parte 3).

## Decisioni per te

### D1 — Come proteggere `main` (oggi impossibile: repository privato + Free)

| Opzione                                                                       | Pro                                                                                                     | Contro                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Passare a **GitHub Pro**                                                   | ruleset e check obbligatori sul repository privato; quota Actions 18 USD invece di 12                   | costo dell'abbonamento (prezzo su github.com/pricing, non verificato in questa revisione)                                                                                                                   |
| B. Rendere il repository **pubblico**                                         | il progetto è già dichiarato MIT/open source; i runner standard diventano gratuiti; ruleset disponibili | irreversibile in pratica (la storia diventa pubblica): serve prima un controllo dei segreti nella storia git; chiunque può aprire PR (servono le impostazioni per le PR da fork); niente runner self-hosted |
| C. **Restare Free** e privato, con la regola scritta "merge solo da PR verde" | costo zero, nessun cambiamento                                                                          | nessun blocco tecnico: un errore umano o di una sessione può portare un merge rosso su `main`                                                                                                               |

**Raccomandazione**: C subito, insieme alla regola in `docs/regia.md` (Parte 3). Poi **B** quando decidi la pubblicazione open source, dopo un controllo dei segreti nella storia. A ha senso solo se il repository deve restare privato a lungo.

**Decisione: C — owner 2026-11-18.** Repository privato su Free; la regola scritta "merge solo da PR verde" è in `docs/regia.md`.

### D2 — Budget e pagamento delle Actions

| Opzione                                                                                                                     | Pro                                                                                       | Contro                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A. Nessun metodo di pagamento                                                                                               | non si spende mai oltre la quota                                                          | a quota finita **tutta** la CI si ferma fino al mese dopo (come ad agosto)   |
| B. Metodo di pagamento + **budget Actions con "Stop usage"** (es. 5 USD) + avvisi 75/90/100% e avvisi quota inclusa 90/100% | spesa massima nota; la CI non si ferma per pochi centesimi; ricevi email prima del limite | va impostato una volta; al raggiungimento del budget la CI si ferma comunque |
| C. Metodo di pagamento senza stop                                                                                           | la CI non si ferma mai                                                                    | spesa non limitata (solo email)                                              |

**Raccomandazione**: B con un budget piccolo (5 USD/mese) e tutti gli avvisi accesi. Se resti su A, accendi almeno gli avvisi sulla quota inclusa al 90/100%.

**Decisione: B — owner 2026-11-18.** Budget di 5 USD con stop e avvisi, impostato dal proprietario nell'interfaccia GitHub; nessuna modifica al repository.

### D3 — Come saltare il job `rust` quando Rust non cambia

| Opzione                                                 | Pro                                                          | Contro                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| A. Job `changes` con `git diff` (P3)                    | nessuno strumento nuovo; compatibile con i check obbligatori | ~20 righe di shell nel YAML                                                  |
| B. Azione `dorny/paths-filter`                          | sintassi più leggibile                                       | **strumento nuovo** di terze parti (da fissare a SHA, licenza da verificare) |
| C. Spostare `rust` in un workflow separato con `paths:` | il più semplice                                              | con `main` protetto i check saltati restano "Pending" e bloccano il merge    |

**Raccomandazione**: A.

**Decisione: A — owner 2026-11-18.** Applicata (P3).

### D4 — Versioni delle azioni

| Opzione                                        | Pro                           | Contro                                                            |
| ---------------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| A. SHA fisso + Dependabot per `github-actions` | sicuro e aggiornato           | Dependabot apre PR, che consumano minuti di CI                    |
| B. SHA fisso, aggiornamento a mano ogni tanto  | sicuro, nessuna PR automatica | ci si dimentica di aggiornare                                     |
| C. Lasciare i tag (`@v5`)                      | zero lavoro                   | rischio "tag spostato" con i segreti di release a portata di mano |

**Raccomandazione**: B ora (sono 7 riferimenti in 3 file). A quando il repository diventa pubblico (minuti gratuiti).

**Decisione: B — owner 2026-11-18.** Applicata (P9).

### D5 — Quando far girare `Build check`

| Opzione                                              | Pro                                                                        | Contro                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A. Solo su PR non in bozza (P5)                      | ~10 min risparmiati per ogni push in bozza; resta un check prima del merge | bisogna aprire le PR come bozza                                        |
| B. Solo a mano (`workflow_dispatch`) prima del merge | massimo risparmio                                                          | non può essere un check obbligatorio automatico; facile da dimenticare |
| C. Come oggi, a ogni push di PR                      | nessun cambiamento                                                         | il job più caro gira anche sui tentativi intermedi                     |

**Raccomandazione**: A.

**Decisione: A — owner 2026-11-18.** Applicata (P5).

### D6 — Suite manuale (`manual-suite.yml`)

| Opzione                                                                                    | Pro                                                                                                        | Contro                                                         |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A. Aggiungerla ora, con `area` = `bundle-windows`, `bundle-macos`, `e2e-ambiente`, `tutto` | Windows/macOS provati **prima** del tag (3 release su 8 sono fallite); test offline e lingua automatizzati | ~1 USD per lancio completo (macOS); un file nuovo da mantenere |
| B. Rimandare alla preparazione della 1.0                                                   | niente lavoro ora                                                                                          | i problemi Windows/macOS si scoprono solo alla release         |
| C. Lanciarla ogni notte (schedule)                                                         | nessuno deve ricordarsene                                                                                  | paga anche nei giorni senza cambiamenti                        |

**Raccomandazione**: A, iniziando dall'area `e2e-ambiente` (solo Linux, costa poco) e aggiungendo le aree bundle quando si prepara la prossima release.

**Decisione: A — owner 2026-11-18.** Applicata con la sola area `e2e-ambiente` (P11).

### D7 — Runner self-hosted

| Opzione                                           | Pro                             | Contro                                                                                                           |
| ------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A. Nessuno (come oggi)                            | zero manutenzione e zero rischi | macOS resta il minuto più caro (~0,8 USD a release)                                                              |
| B. Un Mac di casa per i soli job macOS di release | minuti macOS gratuiti           | va tenuto acceso, sveglio e aggiornato; rischi di sicurezza (P14); non usabile se il repository diventa pubblico |
| C. Runner effimeri su un servizio cloud           | puliti a ogni job               | **strumento nuovo** e un costo a parte                                                                           |

**Raccomandazione**: A. Con la spesa attuale (~1 USD a release) un runner self-hosted non si ripaga.

**Decisione: A — owner 2026-11-18.** Nessun runner self-hosted.

## Passi da fare a mano (interfaccia GitHub)

Le etichette dei pulsanti vengono dalla documentazione citata (consultata il 2026-11-18) e possono cambiare leggermente.

### 1. Controllare il billing (subito, per capire il blocco di agosto)

1. Apri `https://github.com/settings/billing`.
2. Guarda l'uso del mese per **Actions** e quali repository lo hanno consumato: la quota è dell'account, non del singolo repository.
3. Se compare un pagamento non riuscito, aggiorna il metodo di pagamento in **Payment information**.

### 2. Avvisi sulla quota inclusa (90% e 100%)

1. `https://github.com/settings/billing` → **Budgets and alerts**.
2. In "Included usage alerts" spunta **Receive alerts when my included usage reaches 90% and 100%**.

### 3. Budget Actions con stop (se scegli D2-B)

1. `https://github.com/settings/billing` → **Budgets and alerts** → **New budget**.
2. "Budget Type": **Product-level budget**, prodotto **Actions**.
3. "Budget scope": tutto l'account (oppure solo questo repository). **Non** creare budget sovrapposti (account e repository insieme): GitHub lo sconsiglia perché possono bloccare in modo inatteso.
4. "Budget": l'importo (es. 5).
5. Spunta **Stop usage when budget limit is reached**.
6. In "Alerts" spunta **Receive budget threshold alerts** (75%, 90%, 100%).
7. **Create budget**.

### 4. Retention di artifact e log (opzionale, P7)

1. Pagina del repository → **Settings** → nella barra a sinistra **Actions** → **General**.
2. In "Check, workflow run, status, artifact and log retention" scrivi i giorni (es. 30; privati: da 1 a 400).
3. **Save**.

### 5. Permessi del `GITHUB_TOKEN` in sola lettura (P10)

1. **Settings** → **Actions** → **General**.
2. In "Workflow permissions" scegli l'opzione con accesso in sola lettura a contenuti e pacchetti.
3. Lascia **spenta** "Allow GitHub Actions to create and approve pull requests".
4. **Save**. (`release.yml` chiede già `contents: write` nel job, quindi continua a funzionare.)

### 6. Ruleset per `main` (solo dopo D1-A o D1-B)

1. Pagina del repository → **Settings** → a sinistra, sotto "Code, planning, and automation", apri **Rules** e poi **Rulesets**.
2. **New ruleset** → **New branch ruleset**.
3. "Ruleset name": `main protetto`. Enforcement status: **Active**.
4. "Bypass list": lasciala **vuota**.
5. "Target branches" → **Add a target** → includi il ramo predefinito (`main`).
6. Spunta **Restrict deletions** e **Block force pushes**.
7. Spunta **Require a pull request before merging**, con "Required approvals" = **0**.
8. Spunta **Require status checks to pass before merging** → **Add checks** e aggiungi esattamente `frontend`, `e2e`, `rust`, `bundle`. I nomi compaiono solo se quei job hanno girato di recente, cosa già vera.
9. Lascia spenta "Require branches to be up to date before merging" (modalità "loose": meno run). Prima di unire una PR, aggiornala a mano se `main` è andato avanti (vedi "merge di prova" nella Parte 3).
10. **Create**.

## Parte 3 — Regole per lavorare con più sessioni Claude Code

### Cosa vale per questo progetto e cosa no

- **Non si applicano**: "database" e "API" nel senso di un server. L'app è desktop e local-first: niente database e niente API di rete.
- **Equivalenti in questo progetto** (i "file condivisi" da toccare una sessione alla volta):
  - **Contratto IPC** fra frontend e Rust: `src-tauri/src/commands/**`, `src/lib/tauri/**`. È l'equivalente del "contratto API".
  - **Migrazioni**: schema e migrazioni delle impostazioni (`src/stores/settings.ts`, `src/lib/tauri/settings-store.ts`).
  - **Progetto app**: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/**`, `src-tauri/Cargo.toml`/`Cargo.lock`, `package.json`/`bun.lock`, file i18n `src/i18n/locales/**`, token di tema (`src/styles/**`, `DESIGN.md`).
  - **Workflow**: `.github/workflows/**`.
- **Revisori esperti**, solo per le aree toccate: sicurezza e privacy (capabilities, CSP, sanitizzazione HTML, nessuna chiamata di rete); IPC e Rust; app e accessibilità (WCAG 2.2 AA, tastiera, contrasto, i18n it/en). "Database" e "API" non servono.

### Proposta di testo per `docs/regia.md` (approvata dall'owner il 2026-11-18)

- **Stato**: applicata in `docs/regia.md`, adattata alle decisioni D1 = C, D2 = B e D6 (oggi solo l'area `e2e-ambiente`).

```markdown
# Regia: come lavorano più sessioni Claude Code

Scopo: tante sessioni in parallelo senza conflitti, senza minuti CI sprecati e
senza decisioni prese alle spalle del proprietario.

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
  Rust del `CLAUDE.md`. La CI a pagamento gira sulla PR.
- **Push solo a fine lavoro** (o a fine fetta), non a ogni commit. **Mai lo stesso
  commit su più rami**: ogni ramo con PR fa ripartire la CI.
- Le PR si aprono **in bozza** (draft). Si segnano "Ready for review" solo quando
  la fetta è finita: così il job lungo `bundle` gira una volta sola.
- Dopo un push, **controllare l'esito della CI ogni 10–15 minuti** finché non è
  finita. I promemoria che una sessione si programma da sola possono non partire
  (la sessione è occupata, chiusa o scaduta; i limiti d'uso possono rimandarli):
  per questo **la regia controlla comunque** le PR aperte quando riceve un
  resoconto e prima di ogni giro di decisioni.
- Se usiamo un runner self-hosted: una run persa ("in progress" senza log) si
  rilancia **una volta**; se si perde di nuovo, si controlla la macchina
  (accesa, servizio attivo, non in sospensione).

## Decisioni

- Le decisioni del proprietario si scrivono **subito**, con la data, nel file di
  decisioni dell'ondata (es. `docs/consolidation/wN-decisions.md`).
- Ogni testo visibile all'utente (it + en) scritto da una sessione è marcato
  **"da approvare"** finché il proprietario non lo approva.
- La regia porta le domande al proprietario **tutte insieme**, ognuna con 2–3
  opzioni, pro e contro e una raccomandazione.

## Merge su `main`

Si unisce su `main` **solo** con una PR approvata dal proprietario e CI verde
(`frontend`, `e2e`, `rust`, `bundle`). Prima del merge:

1. **Revisione esperta completa, sola lettura**: sicurezza e privacy, IPC e Rust,
   app e accessibilità. (Database e API non si applicano: app desktop local-first.)
2. **Merge di prova** del ramo su `origin/main` aggiornato, senza conflitti; se
   `main` è andato avanti, aggiornare il ramo e far ripartire la CI.
3. **Una sola lista di prove sul dispositivo**, in due colonne:
   "cosa fare" / "cosa deve succedere" (menu nativi, dialoghi, cestino,
   salvataggio, tema, lingua, aggiornamento).
4. Per un'ondata grossa o prima di un tag: la suite manuale completa
   (`workflow_dispatch`, area `tutto`), se esiste.

## Limiti d'uso

Prima di un lavoro grosso (molte sessioni in parallelo), la regia avvisa il
proprietario dei limiti d'uso del piano Claude (finestra di 5 ore e limite
settimanale). Le sessioni cloud li condividono con tutto il resto dell'uso
dell'account. Consumo attuale: `/usage` o `claude.ai/settings/usage`.

## Chiusura

A fine fetta la regia controlla il resoconto, verifica la CI della PR e archivia
la sessione.
```

### Proposta di righe per `CLAUDE.md` (approvata dall'owner il 2026-11-18)

- **Stato**: approvata insieme alla rimozione della riga "TanStack Highlight" dai Reference docs (libreria tolta nella Wave 2); da applicare in un commit a parte.

```markdown
## Multi-session work

- Coordination rules live in `docs/regia.md` — read it before starting a slice.
- Run local checks (`bun run typecheck`, `bun run lint`, `bun run test`, Rust command above when Rust changes) before every commit; paid CI runs on the PR.
- Open PRs as draft; push at the end of a slice, never the same commit to several branches.
- Shared files (IPC commands, settings migrations, `tauri.conf.json`/capabilities, lockfiles, i18n locales, workflows) are changed by one session at a time.
- Merge to `main` only through an owner-approved PR with green CI (`frontend`, `e2e`, `rust`, `bundle`).
- Record owner decisions immediately with their date; mark new user-facing strings "da approvare".
```

### Perché queste regole (fonti Claude Code)

- **Le sessioni cloud consumano gli stessi limiti d'uso** di tutto il resto ("It counts toward your plan's usage limits"; "cloud sessions share rate limits with all other Claude and Claude Code usage within your account. Running multiple tasks in parallel consumes more rate limits proportionately", [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web), consultato il 2026-11-18). Da qui l'avviso prima dei lavori grossi. Il dettaglio delle finestre (5 ore, settimanale) è nel Help Center di Claude, richiamato dalla pagina [Manage costs effectively](https://code.claude.com/docs/en/costs) ma **non verificato** in questa revisione. Per il consumo attuale: `/usage`.
- **I promemoria programmati non sono garantiti**: i task di sessione "only fire while Claude Code is running and idle", "No catch-up for missed fires" e quelli ricorrenti scadono dopo 7 giorni ([Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks), consultato il 2026-11-18). I task cloud, a limite d'uso raggiunto, "additional runs are rejected until your usage window resets" ([Automate work with scheduled tasks](https://code.claude.com/docs/en/routines), consultato il 2026-11-18). Da qui il controllo di riserva della regia.
- **Seguire una PR**: con l'auto-fix Claude "subscribes to GitHub activity on the PR" e reagisce a CI fallite e commenti. Però "GitHub does not emit a webhook when the base branch advances and creates a merge conflict" ([Use Claude Code in the cloud — Auto-fix](https://code.claude.com/docs/en/claude-code-on-the-web#auto-fix-pull-requests), consultato il 2026-11-18). Da qui il "merge di prova" prima del merge. Attenzione: l'auto-fix fa push, e ogni push rilancia la CI a pagamento.
- **Funzione Projects**: Claude Code ha in beta i "Projects", che coordinano più sessioni cloud con istruzioni e memoria comuni (Pro, Max, Ultra; [Let Claude coordinate ongoing work with Projects](https://code.claude.com/docs/en/claude-projects), consultato il 2026-11-18). È un'alternativa alla regia fatta a mano, da valutare: per ora le regole sopra valgono in entrambi i casi.

## Fonti (tutte consultate il 2026-11-18)

GitHub:

- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)
- [GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- [Setting up budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets) · [Budgets and alerts](https://docs.github.com/en/billing/concepts/budgets-and-alerts)
- [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) (paths/paths-ignore, concurrency, timeout-minutes, workflow_dispatch inputs)
- [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Control workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [Dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [Removing workflow artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts)
- [Managing GitHub Actions settings for a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) · [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)
- [Configuring the self-hosted runner application as a service](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application) · [Self-hosted runners reference](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)
- [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [Re-running workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

Claude Code:

- [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Automate work with scheduled tasks](https://code.claude.com/docs/en/routines)
- [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)
- [Let Claude coordinate ongoing work with Projects](https://code.claude.com/docs/en/claude-projects)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)

Altre:

- [Swatinem/rust-cache README](https://github.com/Swatinem/rust-cache#readme) (`save-if`)
- [Playwright — Continuous Integration, Caching browsers](https://playwright.dev/docs/ci#caching-browsers) (letto dal sorgente `microsoft/playwright/docs/src/ci.md`)
- `bun install --help` (bun 1.4.4, locale): `--frozen-lockfile`. Il sito bun.com non era raggiungibile da questa sessione.
- Non raggiungibili da questa sessione: gli endpoint `actions/caches`, `actions/cache/usage` e `actions/runners` (bloccati dal proxy) e la pagina Billing dell'account.
