// Type declarations for the pure helpers exported by bump-version.mjs, so the
// vitest test (TypeScript) can import them under strict mode.

export function isValidSemver(v: unknown): boolean;
export function setJsonVersion(text: string, version: string): string;
export function setCargoVersion(text: string, version: string): string;
export function releaseChangelog(text: string, version: string, date: string): string;
