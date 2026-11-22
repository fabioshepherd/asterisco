import { create } from "zustand";

/** How many recently-invoked commands the palette floats to the top. */
const MAX_RECENT_COMMANDS = 5;

interface RecentCommandsState {
  /** Recently invoked palette command ids, most recent first. */
  recent: string[];
  /** Record a command as just used; promotes it to the front, de-duplicated. */
  record: (id: string) => void;
}

/**
 * Session recency for the command palette. In-memory by design: it adapts the
 * palette to what you just did without persisting usage to disk (local-first,
 * no behavioural telemetry). Reset on app restart.
 */
export const useRecentCommands = create<RecentCommandsState>()((set) => ({
  recent: [],
  record: (id) =>
    set((state) => ({
      recent: [id, ...state.recent.filter((existing) => existing !== id)].slice(
        0,
        MAX_RECENT_COMMANDS,
      ),
    })),
}));
