# Nome del prodotto

> **Documento storico**, chiuso il 2026-11-20. Fino a quel giorno il progetto si chiamava
> **Smeargle** (nome di lavoro, repository `project-smeargle`); da allora si chiama
> **Asterisco** ovunque. I riferimenti a PR, rami e file di questa pagina sono quelli del
> repository precedente, oggi archivio privato.

Sessioni del 2026-11-19 e del 2026-11-20. Il nome di lavoro era provvisorio, e il nome
definitivo era un gate di rilascio della 1.0 (`docs/ROADMAP.md`, "Remaining for 1.0";
`docs/release-1.0.md`, azione 1).

**Scelto dal proprietario il 2026-11-20: Asterisco.** Prima di renderlo definitivo restano i
controlli di [Cosa non è verificato](#cosa-non-è-verificato): marchi UE su TMview, la
società statunitense ASTERISCO LLC in classe 9, il prodotto «Asterisco» elencato su
SoftwareAdvice, e i domini ([Asterisco, verificato a fondo](#asterisco-verificato-a-fondo)).

**Reso definitivo dal proprietario il 2026-11-20**, con l'unione di questa PR su `main`.
Motivo: il prodotto è gratuito e open source, e il proprietario non intende venderlo. I
controlli sui marchi e sui domini qui sotto restano utili, ma non bloccano la scelta.

Storia in breve:
- **2026-11-19:** dopo otto giri il proprietario sceglie «Seppia», per il momento
  ([Primo percorso](#primo-percorso-2026-11-19-i-giri-fino-a-seppia)).
- **2026-11-20:** il proprietario lo abbandona, perché «Seppia» non è identificativo del
  programma ([Seppia abbandonato](#seppia-abbandonato-2026-11-20)). Si riparte da zero con un
  criterio nuovo, e dopo tre giri sceglie «Asterisco»
  ([Secondo percorso](#secondo-percorso-2026-11-20-il-nome-dice-il-programma)).

Questo documento registra solo la scelta. **Non applica il nome**: per decisione del
proprietario del 2026-11-19, il nome si applica in una PR separata, dopo la scelta (elenco
dei file in `docs/release-1.0.md`, "Cosa tocca il nome"). Niente tag, niente
pubblicazione, nessun dominio registrato e nessun marchio depositato: qui ci sono solo
ricerche pubbliche.

## Il metodo

È lo stesso metodo con cui il proprietario aveva scelto il nome di un'altra sua app,
«Dica» (novembre 2026), adattato a questo prodotto:

1. **Prima i criteri, poi i nomi** (sezione sotto).
2. **Giri di proposte.** Ogni giro ha una tabella con il nome, l'idea e le verifiche; gli
   scartati con il motivo; le tre migliori con pro, contro e una raccomandazione.
3. **Il proprietario indirizza il giro dopo.** Qui i giri sono stati otto fino a Seppia (2026-11-19) e tre
   fino ad Asterisco (2026-11-20).
4. **Verifiche con script e ricerche citate**, più una sezione onesta su quello che non è
   stato verificato.
5. **La scelta si registra con la data**, insieme ai controlli che mancano.

Cosa cambia rispetto a Dica: niente Siri e niente App Store. Al loro posto ci sono gli
editor Markdown omonimi, i pacchetti npm e crates, i repository GitHub e il nome
dell'eseguibile.

## Cosa deve fare il nome

0. **Dice il programma** (criterio aggiunto il 2026-11-20, il più importante): fa capire
   che è un editor e lettore Markdown per i file di un codebase, accanto all'IDE. Un bel nome
   evocativo non basta. Deve anche reggere un logo **monocolore, a sagoma piena e spessa, con
   forme morbide, che dica il programma** (`docs/brand/logo-e-animazioni.md`, ramo
   `brand/logo-plan`, "Brief del segno").
1. **Funziona in italiano e in inglese**, senza significati negativi in nessuna delle due
   lingue né nelle lingue vicine. L'interfaccia è bilingue a parità (`PRODUCT.md`, "Brand
   Commitments").
2. **Regge in minuscolo, senza spazi**: è il nome dell'eseguibile installato (`Cargo.toml`,
   pacchetto `.deb`), parte dell'identifier (allora provvisorio, oggi `it.fabiopastore.asterisco`) e forse il nome del
   repository.
3. **Ha la voce del marchio**: «quick, crafted, unceremonious». Niente aggettivi, niente
   nomi "da startup", niente costume da terminale (`PRODUCT.md`, "Anti-references").
4. **È libero**:
   - nessun editor o lettore Markdown con lo stesso nome;
   - pacchetto npm e crate liberi, o almeno non nel nostro campo;
   - nessun marchio in conflitto nelle classi del software (9 e 42);
   - un dominio raggiungibile.
5. **Non tocca marchi famosi**, anche di altri settori: un marchio che gode di notorietà è
   protetto anche fuori dalle sue classi.

## Primo percorso (2026-11-19): i giri fino a Seppia

Le verifiche di ogni giro usano npm, crates.io e la ricerca repository di GitHub (vedi
[Come è stato verificato](#come-è-stato-verificato)), più una ricerca web per nome.

### Primo giro: oggetti della lettura

Scelto dal proprietario come strada di partenza.

**Il fatto principale:** le parole del leggere sono quasi tutte prese, spesso proprio da
lettori Markdown. Il caso più netto è `leggio`: su GitHub c'è
[arnaugiralt/leggio](https://github.com/arnaugiralt/leggio), che si descrive come "A
markdown reader built for reading. Calm, customizable, offline, private."

Scartati:

| Nome | Perché |
|---|---|
| Leggio | Il repository sopra |
| Recto | [Recto MD](https://iphoneaddict.fr/apps/productivite/recto-md-482.html), lettore Markdown per iOS e Mac |
| Postilla | [atraxsrc/postilla](https://github.com/atraxsrc/postilla), note Markdown per COSMIC |
| Quire | [Quire](https://quire.getty.edu/about/quire/) del Getty, pubblicazione da Markdown |
| Folio | L'app [Folio: Markdown+RST+Code+PDF](https://apps.apple.com/app/id6812495228) |
| Lectern | Un [lettore PDF open source](https://alternativeto.net/software/lectern/) e un [visualizzatore Markdown su AUR](https://aur.archlinux.org/packages/lectern-git) |
| Calamo | [Calamus](https://www.softpedia.com/get/Office-tools/Text-editors/Calamus.shtml), editor con Markdown |
| Glossa, Marginalia, Vellum | Affollati |

Rimasti: Lucerna (npm e crates liberi), Incipit (npm preso da
[un'interfaccia per Claude Code](https://github.com/yc-duan/incipit)), Octavo (vicino a
[un lettore di ebook per Mac](https://github.com/artemnovichkov/Octavo)). Il proprietario
ha chiesto di cambiare strada.

### Secondo giro: nomi brevi

| Nome | Esito |
|---|---|
| Tersa | Scartato: [vercel-labs/tersa](https://github.com/vercel-labs/tersa), canvas di AI di Vercel |
| Lindo, Aldina, Rigo, Aldo | Scartati: già usati o affollati |
| **Terso** | Italiano "terso" e inglese *terse*. Crate libero; npm preso da un pacchetto abbandonato. Esiste il marchio USA «[TERSO SOLUTIONS](https://trademarks.justia.com/789/80/terso-78980817.html)» (RFID) |
| **Manuzio** | Aldo Manuzio ([Smithsonian](https://www.smithsonianmag.com/travel/aldus-manutius-printing-typeface-typography-italics-venice-180956855/?no-ist)). Tutto libero, ma difficile in inglese |

Scartati entrambi dal proprietario.

### Terzo giro: un nome proprio, come Claude o Siri

| Nome | Esito |
|---|---|
| Vico, Tilde | Scartati: [Vico](https://github.com/vicoapp/vico) e [Tilde](https://github.com/gphalkes/tilde) sono editor di testo |
| Brezza, Nitore, Lieve | Scartati: un'auto Suzuki, un repository omonimo, npm preso |
| **Isotta** | Isotta Nogarola, umanista del Quattrocento. Libera su npm, crates e GitHub. Da verificare il marchio auto Isotta Fraschini (classe 12) |
| Tasso | In italiano anche "tasso d'interesse" |
| Elzeviro | Solo italiano, 4 sillabe |

### Quarto giro: scuola e fogli

Proposti dal proprietario: **Pigna** e **Fabriano**, come le marche di quaderni.
Sconsigliati, perché sono marchi famosi:
- Pigna fa anche software per la scuola, con "Pigna Digital School"
  ([Forbes Italia](https://forbes.it/2023/01/17/non-solo-quaderni-pigna-entra-nel-mercato-digitale-dei-software-per-la-scuola/)).
- FABRIANO è un marchio di Fedrigoni S.p.A.
  ([registro USA](https://trademark.justia.com/owners/fedrigoni-s-p-a-2357653)), difeso
  anche dal ministero nel 2025
  ([MIMIT](https://www.mimit.gov.it/it/notizie-stampa/fabriano-urso-pronti-ad-agire-se-confermato-uso-ingannevole-del-marchio)).

| Nome | Esito |
|---|---|
| Foglio | Scartato: [fran-mora/foglio](https://github.com/fran-mora/foglio), "a minimal live-preview markdown editor for macOS" |
| Quaderno, Lavagna, Cartella | Scartati: un software di fatturazione, un issue tracker, un'app di segnalibri |
| Bellacopia | Scartato dopo la verifica: «BELLA COPIA» è un marchio USA di Cartiere Paolo Pigna ([USPTO 88435739](https://www.trademarkelite.com/trademark/trademark-detail/88435739/BELLA-COPIA)) |
| Matita | npm e crates liberi; omonimo il dimostratore di teoremi [Matita](https://www.Wikipedia.org/wiki/Matita) dell'Università di Bologna |
| Gesso, Lode, Dettato, Pastello | Scartati: già usati |

### Quinto giro: cartoleria

| Nome | Esito |
|---|---|
| Lapis | Scartato: [typora-theme-lapis](https://github.com/YiNNx/typora-theme-lapis) e [LapisCV](https://github.com/BingyanStudio/LapisCV), entrambi nel mondo Markdown |
| Inchiostro | Scartato: esiste [Inkiostro](https://alternativeto.net/software/inkiostro-markdown-editor/about/), editor Markdown |
| Risma | npm e crates liberi. RISMA Systems è un software danese di compliance ([G2](https://www.g2.com/it/sellers/risma-systems)); la sua domanda di marchio USA risulta abbandonata ([Markinton](https://markinton.com/trademark/risma-79258357)) |
| Calamaio, Bozza | Liberi, ma lungo e solo italiano il primo; il secondo dice "non finito" |

Il proprietario: «non mi piace nessuno fin'ora». Gli piacciono Pigna e Fabriano per il
**nome di marca**.

### Sesto giro: nomi di marca dalla storia della carta

Fonti: [Comieco](https://www.comieco.org/downloads/6692/2307/PR_storia.pdf),
[italia.it, Pioraco](https://www.italia.it/it/marche/macerata/pioraco/museo-della-carta-e-filigrana-pioraco).

| Nome | Esito |
|---|---|
| Giano | Il fiume delle cartiere di Fabriano e il dio bifronte. Esiste [GianoReader](https://github.com/DrLoki/GianoReader), lettore di ePub |
| Pioraco | La cartiera è di Fedrigoni ([Pulp](https://pulp.fedrigoni.com/articles/pioraco-rebirth-of-a-paper-mill/)): rischio simile a Fabriano |
| Liri | Scartato: [Liri OS](https://github.com/lirios/lirios) |

Scartati tutti dal proprietario. Cosa manca: **il suono**. Il nome deve essere corto e
morbido come Pigna.

### Settimo e ottavo giro: il suono, poi inchiostro, caratteri e stampa

Indicazione del proprietario: «foglio elettronico, qualcosa riguardo caratteri,
inchiostro, stampa».

| Nome | Esito |
|---|---|
| Lettera | Scartato: [Lettera - Markdown Editor](https://apps.apple.com/us/app/-/id6752715912) |
| Torchio | Scartato: [TorchIO](https://github.com/TorchIO-project/torchio) |
| Glifo, Tondo, Noce, Segno | Scartati: npm preso, o affollati |
| Corsivo | Libero; 3 sillabe |
| Foglia | Libera; il "gl" è difficile in inglese |
| **Seppia** | **Scelta dal proprietario** |

## Seppia, verificato a fondo

- **L'idea.** Il nero di seppia è l'inchiostro più antico, con cui si scriveva e si
  disegnava. "Seppia" è anche il tono delle pagine e delle foto vecchie. Tiene insieme
  inchiostro e stampa, e ha il suono che il proprietario cercava: due sillabe, una doppia
  morbida, come Pigna.
- **Suono e lingue:**
  - italiano "SEP-pia";
  - in inglese *sepia* è una parola nota (il colore), senza connotazioni negative;
  - in spagnolo e portoghese *sepia/sépia* è lo stesso animale e lo stesso colore;
  - in italiano è anche il mollusco, in cucina: simpatico, non negativo.
- **Come eseguibile e identifier:** `seppia`, in minuscolo, senza spazi né accenti.
- **npm e crates.io:** `seppia` libero su entrambi (404 il 2026-11-19).
- **GitHub, grafia italiana:**
  - nessun repository "seppia" + markdown, editor o reader;
  - 18 repository con il nome, tutti minori: il più noto è
    [milorepossi/SEPPIA](https://github.com/milorepossi/SEPPIA), un tool di biologia.
- **App:** nessuna app «Seppia» trovata.
- **Attività italiane con il nome:**
  - Seppia S.r.l. di Genova (`seppia.ink`,
    [informativa privacy](https://www.iubenda.com/app/privacy-policy/42897158/legal)),
    attività non chiara;
  - la rivista *La Seppia* (`laseppia.it`,
    [Timone](https://timone.substack.com/p/timone-52020)).
- **Marchi USA:** non è emerso nessun marchio «SEPPIA». Ci sono marchi «SEPIA» vivi
  ([elenco](https://uspto.report/TM/98718916)): HLC Holding, Sepia Ink Block LLC, un vino
  cileno, e una domanda di Karno Sound. Le classi non risultano dalla ricerca pubblica e
  nessuno è chiaramente software.

### Il rischio della grafia inglese «Sepia» (non più da decidere)

Chi parla inglese scriverà facilmente *sepia*. Con quella grafia il campo è affollato:

- [LongHuynh-vn/Sepia](https://github.com/LongHuynh-vn/Sepia): "A Markdown note app for
  macOS. Notes are flat .md files in a folder" (1★).
- [elias001011/sepia-reader](https://github.com/elias001011/sepia-reader): lettore ed
  editor Markdown in Flutter, «Sépia» (1★).
- [Nanako0129/sepia](https://github.com/Nanako0129/sepia): una skill di scrittura per
  agenti AI (3901★). È lo stesso pubblico di chi scrive `CLAUDE.md`.
- "Sepia" è il nome di un tema di lettura in molti editor Markdown: Marked, Inkiostro,
  Apostrophe, VMark, Pennivo
  ([Marked](https://apps.apple.com/us/app/marked-markdown-editor/id6769123480),
  [Inkiostro](https://apps.apple.com/us/app/lettera-markdown-text-editor/id6752715912),
  [Apostrophe](https://apps.gnome.org/Apostrophe/), [VMark](https://github.com/xiaolai/vmark),
  [Pennivo](https://pennivo.app/)). Come
  marchio è quindi meno distintivo in inglese che in italiano.
- npm `sepia` e il crate `sepia` sono presi: un modulo HTTP e un backend Ceph.

Sono progetti piccoli o di altro tipo, e la grafia con la doppia "p" li distingue. Il
rischio è la confusione, non un conflitto di marchio. Va accettato con la scelta
definitiva.

## Seppia abbandonato (2026-11-20)

Il 2026-11-20 il proprietario ha respinto tutti i concept di logo legati a «Seppia» (ramo
`brand/logo-plan`, `docs/brand/logo-e-animazioni.md`) e ha deciso di **cambiare il nome**.
Motivo: «Seppia» **non è identificativo del programma**. È un bel nome, ma non fa capire che
cosa fa l'app. Il rischio della grafia inglese «Sepia», sopra, non è più da decidere.

Il proprietario ha chiesto di ripartire da zero, senza riprendere le strade dei giri
precedenti (oggetti della lettura, cartoleria, carta, stampa). I nomi già scartati o presi
sopra restano scartati.

## Secondo percorso (2026-11-20): il nome dice il programma

Stesso metodo, con il criterio 0 in testa ([Cosa deve fare il nome](#cosa-deve-fare-il-nome)).

**Il criterio, ricontrollato con il proprietario.** Tre modi di «dire il programma»:
- A) un composto descrittivo con un pezzo tecnico (`md`, `doc`, `readme`);
- B) una parola vera che indica l'oggetto dell'app;
- C) un nome inventato con `md` dentro.

Scelta del proprietario: **B**.

### Giro 1: parole dell'oggetto

| Nome | Idea | npm / crate | GitHub e web |
|---|---|---|---|
| Colonna | «Una colonna, mai due» (`PRODUCT.md`, Design Principles) | liberi | nessun editor Markdown omonimo ([ricerca](https://apps.microsoft.com/detail/9nm5dh0bq240?hl=en-US): il più vicino è ColaMD) |
| Docet | «doc» più il latino *docet*, d'uso in italiano | liberi | [diennea/docetproject](https://awesome.ecosyste.ms/projects/github.com%2Fdiennea%2Fdocetproject), gestore di documentazione Java (2★) |
| Capoverso | L'inizio del paragrafo | liberi | 0 repository; solo italiano, 4 sillabe |
| Rileggi | Questi file si rileggono più di quanto si scrivano | liberi | 0 repository; solo italiano |
| Cartiglio | Il riquadro che identifica un disegno di progetto | liberi | 1 repository minore; oscuro |

Scartati:

| Nome | Perché |
|---|---|
| Leggimi | [enricodestefanis/leggimi](https://github.com/enricodestefanis/leggimi): "A fast Markdown viewer and editor for Windows" |
| Pilcrow | [pilcrowmd/pilcrow](https://github.com/pilcrowmd/pilcrow), lettore ed editor Markdown |
| Verso | [zhoulianglen/verso](https://github.com/zhoulianglen/verso), editor Markdown; anche il browser Verso |
| Lector | [atbeta/lector](https://github.com/atbeta/lector), editor Markdown «prima la lettura» |
| Prosa | [Wad-man/prosa](https://github.com/Wad-man/prosa), editor e visualizzatore Markdown |
| Pagina, Libretto, Dossier, Legenda, Colophon | npm e crate presi |
| Margine | Margine OS, distribuzione Linux |
| Plico | [muerzy/plico](https://github.com/muerzy/plico), editor di testo e Markdown |
| Vademecum | crate preso da un lettore Markdown da terminale |
| Faldone, Fascicolo, Dispensa, Sommario, Carteggio, Chiosa, Sfoglia | solo italiano, burocratici o già usati |

Il proprietario: le parole dell'oggetto dicono «testo» più che «Markdown». Chiede un giro
**più Markdown**.

### Giro 2: più Markdown

| Nome | Esito |
|---|---|
| Marcato | *mark*-down, bilingue, npm e crate liberi. Scartato: è il marchio famoso delle macchine per la pasta di Marcato S.p.A. ([Justia](https://trademarks.justia.com/owners/marcato-s-p-a-709237), [Harrods](https://www.harrods.com/en-us/designers/marcato)), lo stesso rischio di Fabriano |
| Cancelletto | Il `#` del titolo. Libero; solo italiano e lungo |
| Leggimd | Leggi + `.md`. Libero; suono duro |
| Marcatore, Marcatura | Liberi; lunghi, solo italiano |
| Emdi | npm preso; [softiq/emdi](https://github.com/softiq/emdi), app per imparare il Markdown |
| Emdash | [emdash-cms/emdash](https://github.com/emdash-cms/emdash), CMS (14 518★) |
| Docile | npm preso; in inglese «docile» è remissivo |
| Diesis, Octothorpe | npm presi |

Il proprietario chiede un altro giro e sceglie la strada dei **simboli del Markdown**.

### Giro 3: simboli del Markdown

| Nome | Esito |
|---|---|
| **Asterisco** | `*`, l'enfasi e le note. In inglese *asterisk*. **Scelto** |
| Cancelletto | `#`. Libero; solo italiano |
| Graffa | `{}`. Libero; dice «codice», non Markdown |
| Aster | [kumarUjjawal/aster](https://github.com/kumarUjjawal/aster), editor Markdown in Rust; [youseonghyeon/aster](https://github.com/youseonghyeon/aster), lettore Markdown |
| Hashmark | [srfreire/hashmark](https://github.com/srfreire/hashmark), editor Markdown in Tauri |
| Backtick | [masud90/backtickle](https://github.com/masud90/backtickle), editor e lettore Markdown |
| Stellina | crate preso |
| Spunta | app di attività omonime |

## Asterisco, verificato a fondo

- **L'idea.** L'asterisco è il segno del Markdown che si scrive di più: `*corsivo*`,
  `**grassetto**`, gli elenchi. Chi scrive README e `CLAUDE.md` lo riconosce subito. Dice il
  formato, non solo la scrittura.
- **Il logo.** Un asterisco pieno e spesso, con le punte tonde: monocolore, morbido, leggibile
  da 16 px. Risponde al brief del segno (`docs/brand/logo-e-animazioni.md`, ramo
  `brand/logo-plan`). Il segno si disegna in una fetta a parte.
- **Suono e lingue:**
  - italiano «a-ste-RI-sco»;
  - in inglese è riconoscibile come *asterisk*;
  - in spagnolo e portoghese è la stessa parola, con lo stesso senso;
  - in inglese «with an asterisk» vuol dire «con riserva»: un'ombra lieve, non un
    significato negativo.
- **Come eseguibile e identifier:** `asterisco`, in minuscolo, senza spazi né accenti.
- **npm e crates.io:** `asterisco`, `asterisco-app` e `asterisco-editor` liberi su npm,
  `asterisco` libero su crates.io (404 il 2026-11-20).
- **GitHub:**
  - 302 repository con il nome, tutti esercizi o lavori minori (il più grande ha 2★);
  - 0 risultati per «asterisco editor», «asterisco reader» e «asterisco notes».
- **App e omonimi:** nessun editor né lettore Markdown «Asterisco» trovato.
- **Da tenere d'occhio:**
  - **ASTERISCO LLC**, società statunitense con 2 marchi USA indicati soprattutto in classe 9,
    con «0% registration rate» secondo un sito aggregatore
    ([trademarkdir](https://trademarkdir.com/owner/asterisco-llc)). La ricerca web non ha
    trovato un marchio «ASTERISCO» registrato.
  - un prodotto «Asterisco» tra gli strumenti di analisi prodotto
    ([SoftwareAdvice](https://www.softwareadvice.com.au/software/778978/Asterisco));
  - [Asterisk](https://www.asterisk.org/), il centralino telefonico open source, a volte
    chiamato «asterisco» in spagnolo e portoghese
    ([desdelinux](https://blog.desdelinux.net/pt/asterisco/)). Il campo è diverso, la
    telefonia, e la parola è diversa in inglese;
  - Asterix, marchio famoso: la parola è diversa, il rischio è basso.
  - Le pagine di trademarkdir, SoftwareAdvice e G2 erano bloccate dalla rete del container:
    non sono state lette.

## Cosa non è verificato

- **Marchi UE e internazionali.** Dal container EUIPO eSearch, TMview e WIPO sono
  bloccati dalla rete. Da fare dal Mac: su TMview, ricerca "contiene" per `asterisco`,
  filtrando le classi 9 e 42
  ([TMview: asterisco](https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=asterisco)).
  TMview comprende EUIPO, UIBM e le designazioni internazionali.
- **Marchi USA «ASTERISCO».** Da guardare sulla ricerca marchi dell'USPTO: lo stato e i
  prodotti delle domande di ASTERISCO LLC in classe 9.
- **Il prodotto «Asterisco» su SoftwareAdvice:** chi lo fa, in che paese, se è vivo.
- **Domini.** RDAP e DNS sono bloccati dal container. Da controllare `asterisco.app`,
  `asterisco.dev`, `asterisco.com` e `asterisco.it`, o un dominio di ripiego (per esempio
  `asterisco-app.org` o `getasterisco.com`). Il dominio decide anche l'identifier, sotto.
- **Parere legale:** questa è una prima verifica, non una ricerca di anteriorità fatta da
  un consulente.

## Decisioni per la fetta che applica il nome (chiuse il 2026-11-20)

Tutte prese e applicate il 2026-11-20 (`docs/release-1.0.md`): identifier
`it.fabiopastore.asterisco`, repository `fabioshepherd/asterisco`, testi approvati, logo
in `docs/brand/`. Restano qui come erano state poste.

- **Identifier.** Allora era provvisorio. Si poteva cambiare senza costi finché non
  esce una release pubblica (`docs/release-1.0.md`). Va scelto in forma inversa su un
  dominio che si controlla: se si prende `asterisco.app`, per esempio
  `app.asterisco.editor`. Da decidere insieme al dominio.
- **Repository.** Va deciso se rinominarlo in `asterisco`. Se sì, cambiano anche
  `plugins.updater.endpoints` e `docs/RELEASING.md` (`docs/release-1.0.md`, "Cosa tocca
  il nome").
- **Testi visibili.** Le etichette `app.title`, `app.name` e `app.about` in it ed en e il
  documento di benvenuto vanno marcati "da approvare".
- **Consensi.** `CLAUDE.md` e `.github/workflows/release.yml` si toccano solo con il
  consenso esplicito del proprietario (`docs/release-1.0.md`).
- **Logo.** Il segno si disegna dopo il nome, con il brief di
  `docs/brand/logo-e-animazioni.md` (ramo `brand/logo-plan`). Il punto di partenza naturale è
  un asterisco pieno con le punte tonde.

## Come è stato verificato

Il 2026-11-19 e il 2026-11-20, dal container della sessione, con script nella cartella
temporanea (non nel repository):

- **npm:** `https://registry.npmjs.org/<nome>`. 404 = libero; 200 = preso, e se ne legge
  la descrizione.
- **crates.io:** `https://crates.io/api/v1/crates/<nome>`. Stessa regola.
- **GitHub:** `gh api search/repositories`, con `<nome> in:name` (ordinato per stelle) e
  `<nome> markdown`.
- **Ricerca web** per nome, insieme a "markdown", "editor", "app" e "trademark". Le fonti
  sono citate accanto a ogni risultato.
- **Il metodo:** quello già usato per il nome di «Dica» (vedi "Il metodo").

<!-- CI docs-only proof (throwaway, never merged). -->
