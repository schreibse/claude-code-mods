#!/bin/bash
# Claude Code Notification hook: a GNOME popup whose click raises Ghostty and focuses this herdr pane.
[ -n "${HERDR_PANE_ID:-}" ] || exit 0
message=$(jq -r '.message // "Claude needs your attention"')
pane=$(herdr pane current 2>/dev/null | jq -c '.result.pane // {}')
[ "$(jq -r '.focused' <<<"$pane")" = true ] && exit 0
title=$(jq -r '.terminal_title_stripped // empty' <<<"$pane")
setsid -f bash -c '
  action=$(notify-send --app-name=Claude -i com.mitchellh.ghostty -h string:desktop-entry:com.mitchellh.ghostty -A default=Show --wait -- "$1" "$2")
  [ "$action" = default ] && herdr agent focus "$3" >/dev/null
' _ "${title:-Claude}" "$message" "$HERDR_PANE_ID" >/dev/null 2>&1 </dev/null
