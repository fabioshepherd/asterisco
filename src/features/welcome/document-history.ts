import { useDocuments } from "@/stores/document";

/*
 * Whether the last open document has just closed. The empty state uses it to
 * tell a cold launch, or any other remount (static: nothing animates at launch),
 * from the return the user caused by closing the last document (the mark's A1
 * moment). Set on the transition to no documents, consumed once.
 */
let justEmptied = false;
let hadDocuments = useDocuments.getState().documents.length > 0;

useDocuments.subscribe((state) => {
  const has = state.documents.length > 0;
  if (hadDocuments && !has) justEmptied = true;
  if (has) justEmptied = false;
  hadDocuments = has;
});

/** True once after the last document closes; false afterwards until it happens again. */
export function consumeLastDocumentClosed(): boolean {
  const value = justEmptied;
  justEmptied = false;
  return value;
}

/** Tests only: forget the session so far. */
export function resetDocumentHistory(): void {
  justEmptied = false;
  hadDocuments = useDocuments.getState().documents.length > 0;
}
