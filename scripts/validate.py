"""校验 skills/ 下每个 SKILL.md 的 frontmatter。用法：python scripts/validate.py [skills_root]"""
import re
import sys
from pathlib import Path

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
REQUIRED = ("name", "description", "license")


def frontmatter(text: str) -> dict:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    fm = {}
    for line in text[4:end].splitlines():
        if line.startswith(" ") or ":" not in line:
            continue
        k, _, v = line.partition(":")
        fm[k.strip()] = v.strip().strip('"')
    return fm


def check(skill_dir: Path) -> list:
    md = skill_dir / "SKILL.md"
    fm = frontmatter(md.read_text(encoding="utf-8"))
    if not fm:
        return ["frontmatter 缺失"]
    probs = [f"缺少 {k}" for k in REQUIRED if not fm.get(k)]
    name = fm.get("name", "")
    if name and not NAME_RE.match(name):
        probs.append(f"name 不合规范: {name}")
    if name != skill_dir.name:
        probs.append(f"name({name}) 与目录名({skill_dir.name}) 不一致")
    return probs


def main(root: str) -> int:
    rc = 0
    for md in sorted(Path(root).glob("*/*/SKILL.md")):
        for p in check(md.parent):
            print(f"{md.parent.as_posix()}: {p}")
            rc = 1
    print("validate: OK" if rc == 0 else "validate: FAIL")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "skills"))
