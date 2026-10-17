// Small actions bound to keys or run from herdr's action list.
import { herdr, herdrJson, listPanes, paintPane, paintWorkspace, readConfig, readJsonEnv, reroll } from "./common.mjs";
import { paletteChoices } from "./lib/palettes.mjs";
import { applyPalette } from "./palette.mjs";

const action = process.argv[2];
const context = readJsonEnv("HERDR_PLUGIN_CONTEXT_JSON");
const paneId = context.focused_pane_id ?? context.pane_id ?? process.env.HERDR_PANE_ID;

switch (action) {
  case "stats": {
    const plugin = process.env.HERDR_PLUGIN_ID ?? "tamagoxtix";
    const res = herdr(["plugin", "pane", "open", "--plugin", plugin, "--entrypoint", "stats"]);
    process.exit(res.status ?? 1);
  }
  case "icon": {
    const plugin = process.env.HERDR_PLUGIN_ID ?? "tamagoxtix";
    const res = herdr(["plugin", "pane", "open", "--plugin", plugin, "--entrypoint", "icon-picker"]);
    process.exit(res.status ?? 1);
  }
  case "palette-refresh": {
    applyPalette(readConfig().palette ?? "omarchy");
    break;
  }
  case "palette-next": {
    const choices = paletteChoices();
    const current = readConfig().palette ?? "omarchy";
    const palette = applyPalette(choices[(choices.indexOf(current) + 1) % choices.length]);
    herdr(["notification", "show", "TamaGoxtix", "--body", `Palette: ${palette.label}`]);
    break;
  }
  case "reroll": {
    const pane = paneId ? herdrJson(["pane", "get", paneId])?.pane : null;
    if (!pane?.agent) {
      herdr(["notification", "show", "TamaGoxtix", "--body", "Focus an agent pane first."]);
      break;
    }
    reroll(pane);
    paintPane(pane);
    paintWorkspace(pane.workspace_id, listPanes());
    break;
  }
  default:
    console.error(`unknown action: ${action}`);
    process.exit(2);
}
