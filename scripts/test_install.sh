#!/usr/bin/env bash
# 运行：bash scripts/test_install.sh；所有安装只写入临时目录。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_parent="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
test_root=$(mktemp -d "$temp_parent/smartskill-test.XXXXXX")
[[ $test_root == "$temp_parent"/smartskill-test.* ]] || exit 1
trap 'rm -rf "$test_root"' EXIT
cd "$test_root"

expect_invalid() {
  local output status=0
  output=$(bash "$ROOT/install.sh" --scope project "$@" 2>&1) || status=$?
  [[ $status == 2 && -n $output ]] || { echo "FAIL: expected argument error: $* ($status)" >&2; exit 1; }
}

expect_invalid --component typo
expect_invalid --scope typo
expect_invalid --agent codex,missing
expect_invalid --agent '.*'
expect_invalid --agent codex,
expect_invalid --skill ../coding
expect_invalid --skill before-build,,doc-writing
for option in --component --skill --agent --scope; do
  expect_invalid "$option"
  expect_invalid "$option" --dry-run
  expect_invalid "$option" ''
done
[[ ! -e .agents ]] || { echo 'FAIL: invalid arguments wrote files' >&2; exit 1; }

output=$(bash "$ROOT/install.sh" --scope project --agent codex --skill before-build --dry-run)
[[ $output == *'[dry-run] before-build -> '*'/skills/before-build'* && ! -e .agents ]]
mkdir -p 'repository with spaces/skills/coding'
cp "$ROOT/install.sh" 'repository with spaces/install.sh'
cp -R "$ROOT/skills/coding/before-build" 'repository with spaces/skills/coding/'
output=$(bash "$test_root/repository with spaces/install.sh" --component coding --scope project --dry-run)
[[ $output == *'[dry-run] before-build -> '* && ! -e .agents ]]
echo 'PASS: invalid values, missing values, exact agent matching, preflight validation, dry-run, spaced paths'
