/**
 * Suite spec 0017, AC-18: what an action on the person pane calls when it ends. `settled` reloads
 * the person and the list once (and `me` after a role change); `conflict` answers true when the
 * error means someone else changed the person, after showing their latest state.
 */
export type PersonActions = {
  settled: (options?: { roleChanged?: boolean; quietGone?: boolean }) => void;
  conflict: (error: unknown) => boolean;
};
