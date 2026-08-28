#!/usr/bin/env bash
# 将 smartskill 的 skill 复制到各 CLI 的 skills 目录。
# 用法：./install.sh [--component coding|thinking|search|all] [--skill a,b] [--agent claude,codex,...] [--scope user|project] [--dry-run]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENT=all; SKILLS=""; AGENTS=universal; SCOPE=user; DRY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --component) COMPONENT="$2"; shift 2;;
    --skill) SKILLS="$2"; shift 2;;
    --agent) AGENTS="$2"; shift 2;;
    --scope) SCOPE="$2"; shift 2;;
    --dry-run) DRY=1; shift;;
    *) echo "未知参数: $1" >&2; exit 2;;
  esac
done

# 目标目录表：唯一来源，格式 agent:user 相对路径:project 相对路径
TARGETS="
claude:.claude/skills:.claude/skills
codex:.codex/skills:.agents/skills
opencode:.config/opencode/skills:.agents/skills
pi:.pi/agent/skills:.pi/skills
hermes:.hermes/skills:.hermes/skills
dsh:.dsh/skills:.dsh/skills
universal:.agents/skills:.agents/skills
"

target_dir() {
  local line
  line=$(echo "$TARGETS" | grep "^$1:") || { echo "未知 agent: $1" >&2; exit 2; }
  if [[ $SCOPE == user ]]; then
    echo "$HOME/$(echo "$line" | cut -d: -f2)"
  else
    echo "$PWD/$(echo "$line" | cut -d: -f3)"
  fi
}

selected=()
if [[ -n $SKILLS ]]; then
  IFS=, read -ra names <<< "$SKILLS"
  for n in "${names[@]}"; do
    found=$(find "$ROOT/skills" -mindepth 2 -maxdepth 2 -type d -name "$n")
    [[ -n $found ]] || { echo "未找到 skill: $n" >&2; exit 1; }
    selected+=("$found")
  done
else
  pattern="$ROOT/skills/*/*"
  [[ $COMPONENT != all ]] && pattern="$ROOT/skills/$COMPONENT/*"
  for d in $pattern; do [[ -d $d ]] && selected+=("$d"); done
fi

IFS=, read -ra agents <<< "$AGENTS"
for a in "${agents[@]}"; do
  dest=$(target_dir "$a")
  for s in "${selected[@]}"; do
    name=$(basename "$s"); to="$dest/$name"; note=""
    [[ -e $to ]] && note="(覆盖)"
    if [[ $DRY == 1 ]]; then echo "[dry-run] $name -> $to $note"; continue; fi
    mkdir -p "$dest"; rm -rf "$to"; cp -R "$s" "$to"; echo "$name -> $to $note"
  done
done
