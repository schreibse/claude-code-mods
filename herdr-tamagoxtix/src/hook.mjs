// Event hook: repaint the monster of the pane whose agent changed, and the
// Space it lives in. Also the startup hook: paint everything once.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { listPanes, paintAll, paintPane, paintWorkspace, readJsonEnv, sidebarEnabled, spreadIcons } from "./common.mjs";
import { stateDir } from "./lib/usage-node.mjs";

const eventName = process.env.HERDR_PLUGIN_EVENT ?? "";
const event = readJsonEnv("HERDR_PLUGIN_EVENT_JSON");

if (process.env.TAMAGOXTIX_DEBUG) {
  mkdirSync(stateDir(), { recursive: true });
  appendFileSync(join(stateDir(), "herdr-events.log"), JSON.stringify({ eventName, event }) + "\n");
}

// keep the status bar script current after the plugin updates
if (eventName === "startup") {
  try {
    const { readConfig } = await import("./common.mjs");
    if (readConfig().herdrTheme === true) (await import("./theme.mjs")).install();
  } catch {}
}

if (!sidebarEnabled()) {
  // sidebar icons are off: nothing to paint
} else if (eventName === "startup") {
  paintAll();
} else {
  const data = event?.data ?? event ?? {};
  const paneId = data.pane_id ?? data.pane?.pane_id;
  const panes = listPanes();
  const pane = panes.find((p) => p.pane_id === paneId);
  if (eventName === "pane.agent_detected") spreadIcons(panes);
  if (pane) {
    paintPane(pane);
    paintWorkspace(pane.workspace_id, panes);
  } else {
    // Unknown shape or a pane that already left: repaint everything.
    paintAll();
  }
}
