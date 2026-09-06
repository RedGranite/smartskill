#!/usr/bin/env bash
# 将 smartskill 的 skill 复制到各 CLI 的 skills 目录。
# 用法：./install.sh [--component coding|thinking|search|all] [--skill a,b] [--agent claude,codex,...] [--scope user|project] [--dry-run]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENT=all; SKILLS=""; AGENTS=universal; SCOPE=user; DRY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --component|--skill|--agent|--scope)
      [[ $# -ge 2 && -n $2 && $2 != --* ]] || { echo "参数缺少值: $1" >&2; exit 2; };;
  esac
  case "$1" in
    --component) COMPONENT="$2"; shift 2;;
    --skill) SKILLS="$2"; shift 2;;
    --agent) AGENTS="$2"; shift 2;;
    --scope) SCOPE="$2"; shift 2;;
    --dry-run) DRY=1; shift;;
    *) echo "未知参数: $1" >&2; exit 2;;
  esac
done

case "$COMPONENT" in coding|thinking|search|all) ;; *) echo "未知 component: $COMPONENT" >&2; exit 2;; esac
case "$SCOPE" in user|project) ;; *) echo "未知 scope: $SCOPE" >&2; exit 2;; esac
for list in "$AGENTS" "$SKILLS"; do
  [[ $list != ,* && $list != *, && $list != *,,* ]] || { echo "列表包含空名称: $list" >&2; exit 2; }
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
  local agent user project
  while IFS=: read -r agent user project; do
    if [[ -n $agent && $agent == "$1" ]]; then
      if [[ $SCOPE == user ]]; then echo "$HOME/$user"; else echo "$PWD/$project"; fi
      return
    fi
  done <<< "$TARGETS"
  echo "未知 agent: $1" >&2; exit 2
}

IFS=, read -ra agents <<< "$AGENTS"
destinations=()
for a in "${agents[@]}"; do destinations+=("$(target_dir "$a")"); done

selected=()
if [[ -n $SKILLS ]]; then
  IFS=, read -ra names <<< "$SKILLS"
  for n in "${names[@]}"; do
    [[ $n =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "无效 skill 名称: $n" >&2; exit 2; }
    found=$(find "$ROOT/skills" -mindepth 2 -maxdepth 2 -type d -name "$n")
    [[ -n $found ]] || { echo "未找到 skill: $n" >&2; exit 1; }
    selected+=("$found")
  done
else
  candidates=("$ROOT"/skills/*/*)
  [[ $COMPONENT != all ]] && candidates=("$ROOT"/skills/"$COMPONENT"/*)
  for d in "${candidates[@]}"; do [[ -d $d ]] && selected+=("$d"); done
fi
[[ ${#selected[@]} -gt 0 ]] || { echo "未找到可安装的 skill" >&2; exit 1; }

for dest in "${destinations[@]}"; do
  for s in "${selected[@]}"; do
    name=$(basename "$s"); to="$dest/$name"; note=""
    [[ -e $to || -L $to ]] && note="(备份后替换)"
    if [[ $DRY == 1 ]]; then echo "[dry-run] $name -> $to $note"; continue; fi
    (
      mkdir -p "$dest"
      parent=$(cd "$dest/.." && pwd)
      stage=$(mktemp -d "$parent/.smartskill-install.XXXXXX")
      trap 'rm -rf "$stage"' EXIT
      cp -R "$s" "$stage/$name"
      backup=""
      if [[ -e $to || -L $to ]]; then
        mkdir -p "$parent/smartskill-backups"
        backup_slot=$(mktemp -d "$parent/smartskill-backups/$name.XXXXXX")
        backup="$backup_slot/$name"
        mv "$to" "$backup"
      fi
      if ! mv "$stage/$name" "$dest/"; then
        if [[ -n $backup ]]; then
          if ! mv "$backup" "$dest/"; then echo "安装失败，旧版本保留在 $backup" >&2; exit 1; fi
          rmdir "$backup_slot"
        fi
        exit 1
      fi
      echo "$name -> $to $note"
      if [[ -n $backup ]]; then echo "备份 -> $backup"; fi
    )
  done
done
