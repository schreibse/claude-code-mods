// GENERATED from shared/forge.mjs by scripts/sync-shared.mjs. Edit the original.
// Where a project's repository lives, from its git remote, and a guard for
// text that comes from outside (remotes, branches, tags) before it is drawn.
//
// Pure module shared by the herdr plugin and the Claude Code mod.

/**
 * The forge a remote lives on: github.com, or GitLab (gitlab.com or a
 * self-hosted instance whose host names it), with the project's path.
 * @param {string | null | undefined} remote
 * @returns {{ forge: "github" | "gitlab", host: string, path: string } | null}
 */
export function parseRemote(remote) {
  const m = remote?.match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)(?::\d+(?=\/))?[:/](.+?)(?:\.git)?\/?$/);
  if (!m) return null;
  const host = m[1] ?? "";
  const path = m[2] ?? "";
  if (!/^[\w.-]+$/.test(host) || !/^[\w.\-/]+$/.test(path)) return null;
  if (host === "github.com") return { forge: "github", host, path };
  if (/gitlab/i.test(host)) return { forge: "gitlab", host, path };
  return null;
}

/**
 * Text safe to draw in a terminal: no control characters (C0, DEL, C1), so a
 * crafted remote, branch or tag cannot send escape sequences; capped length.
 * @param {unknown} text
 * @param {number} [max]
 * @returns {string}
 */
export function clean(text, max = 80) {
  return String(text ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").slice(0, max);
}
