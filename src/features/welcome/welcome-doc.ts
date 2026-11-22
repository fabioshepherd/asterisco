import type { Language } from "@/stores/settings";

/*
 * The bundled first-run document. It is seeded once (see `use-startup.ts`) and is
 * a real, editable document — not a tour.
 *
 * It teaches by being what it describes: the Markdown a codebase is made of
 * (headings, inline code, a table, a fenced block with highlighting, a diagram),
 * shown rendered while it stays editable. Deliberately short — PRODUCT.md's
 * audience opens this window mid-task, not to read a manual — and deliberately
 * free of display math, which belongs to a different reader than the one who
 * came here for a README.
 */

const EN = `# Asterisco

A local-first editor for the Markdown a codebase is made of: READMEs, ADRs, specs,
changelogs, the \`AGENTS.md\` you keep rewriting. One column — what you edit is
already what it will look like.

This file is a real document. Delete it and start yours, or just keep typing here.

## While you type

Type \`## \` for a heading, \`- \` for a list, \`> \` for a quote, or wrap a word in
backticks for \`code\`. Tables, links and task lists format the moment you finish them.

| Shortcut | Action |
| --- | --- |
| \`Cmd/Ctrl + Shift + P\` | command palette — everything is in there |
| \`Cmd/Ctrl + O\` · \`+ Shift + O\` | open a file · open a folder |
| \`Cmd/Ctrl + F\` · \`+ Shift + F\` | find here · search the whole folder |
| \`Cmd/Ctrl + /\` | source mode — the raw Markdown |
| \`Cmd/Ctrl + S\` | save |

Fenced blocks keep their highlighting while you edit them:

\`\`\`ts
export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
\`\`\`

Diagrams render in place, so an architecture note stays readable in the file itself:

\`\`\`mermaid
flowchart LR
  Edit --> Render --> Commit
\`\`\`

## Where your files live

Open a folder and the whole \`docs/\` tree sits in the sidebar, searchable. Nothing is
imported and nothing is converted: your files stay plain \`.md\` on your disk, readable
by every other tool you own.

No account, no telemetry, no network.
`;

const IT = `# Asterisco

Un editor local-first per il Markdown di cui è fatto un progetto: README, ADR,
specifiche, changelog, l'\`AGENTS.md\` che riscrivi di continuo. Una colonna sola —
quello che modifichi è già come apparirà.

Questo file è un documento vero. Cancellalo e comincia il tuo, oppure continua a
scrivere qui.

## Mentre scrivi

Scrivi \`## \` per un titolo, \`- \` per un elenco, \`> \` per una citazione, o racchiudi
una parola fra backtick per il \`codice\`. Tabelle, link e liste di cose da fare si
formattano appena le finisci.

| Scorciatoia | Azione |
| --- | --- |
| \`Cmd/Ctrl + Shift + P\` | tavolozza comandi — lì dentro c'è tutto |
| \`Cmd/Ctrl + O\` · \`+ Shift + O\` | apri un file · apri una cartella |
| \`Cmd/Ctrl + F\` · \`+ Shift + F\` | cerca qui · cerca in tutta la cartella |
| \`Cmd/Ctrl + /\` | modalità sorgente — il Markdown grezzo |
| \`Cmd/Ctrl + S\` | salva |

I blocchi di codice mantengono l'evidenziazione mentre li modifichi:

\`\`\`ts
export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
\`\`\`

I diagrammi vengono resi sul posto, così una nota di architettura resta leggibile
dentro al file:

\`\`\`mermaid
flowchart LR
  Scrivi --> Rendi --> Committa
\`\`\`

## Dove stanno i tuoi file

Apri una cartella e l'intero albero \`docs/\` è nella barra laterale, cercabile. Niente
viene importato e niente viene convertito: i tuoi file restano \`.md\` in chiaro sul tuo
disco, leggibili da qualsiasi altro strumento tu abbia.

Nessun account, nessuna telemetria, nessuna rete.
`;

/** The bundled welcome document, in the user's language. */
export function welcomeDocument(language: Language): string {
  return language === "it" ? IT : EN;
}
