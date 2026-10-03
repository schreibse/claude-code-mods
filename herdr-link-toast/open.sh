#!/usr/bin/env bash
url=${HERDR_PLUGIN_CLICKED_URL:?no clicked URL}
herdr=${HERDR_BIN_PATH:-herdr}
case $url in
    http://localhost/open-file/*) target=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(urllib.parse.urlsplit(sys.argv[1]).path.removeprefix("/open-file")))' "$url"); opened="Opened file" ;;
    *) target=$url; opened="Opened in browser" ;;
esac
if xdg-open "$target" >/dev/null 2>&1; then
    "$herdr" notification show "$opened" --body "$target" --sound none
else
    "$herdr" notification show "Could not open link" --body "$target" --sound request
fi
