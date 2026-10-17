// UI strings: English, plus Portuguese when the locale (or the config's
// "lang") starts with "pt".
import { readConfig } from "./common.mjs";

const STRINGS = {
  en: {
    usage: "token usage",
    palette: "palette",
    loading: "Reading Claude Code transcripts…",
    today: "Today",
    session: "Session",
    week: "Week",
    session5h: "5h limit",
    weekly: "Weekly",
    resetsIn: "resets in",
    noReading: "no reading yet",
    limitsHint: "Limits appear once the tamagoxtix Claude Code mod sees a response.",
    lastDays: "Last 14 days",
    todayByHour: "Today by hour",
  },
  pt: {
    usage: "consumo de tokens",
    palette: "paleta",
    loading: "Lendo os históricos do Claude Code…",
    today: "Hoje",
    session: "Sessão",
    week: "Semana",
    session5h: "Limite 5h",
    weekly: "Semanal",
    resetsIn: "renova em",
    noReading: "sem leitura ainda",
    limitsHint: "Os limites aparecem quando o mod tamagoxtix do Claude Code vê uma resposta.",
    lastDays: "Últimos 14 dias",
    todayByHour: "Hoje por hora",
  },
};

const lang = (() => {
  const chosen = readConfig().lang ?? process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "";
  return chosen.toLowerCase().startsWith("pt") ? "pt" : "en";
})();

export function t(key) {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}
