import { invoke } from "@tauri-apps/api/core";

// Typed bridge to bundled-resource Rust commands (src-tauri/src/commands/fs.rs).
// Resources are read in Rust via std::fs after resolving BaseDirectory::Resource.

/** Read the bundled THIRD-PARTY-NOTICES.txt (open-source license notices). */
export function readThirdPartyNotices(): Promise<string> {
  return invoke<string>("read_third_party_notices");
}
