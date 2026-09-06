"""运行：python scripts/test_validate.py。仅在临时目录检查校验器。"""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from validate import main


def validate(root):
    with redirect_stdout(StringIO()) as output:
        code = main(str(root))
    return code, output.getvalue()


with TemporaryDirectory(prefix="smartskill-validate-") as temp:
    root = Path(temp) / "skills"
    code, output = validate(root)
    assert code == 1 and "目录不存在" in output
    root.mkdir()
    code, output = validate(root)
    assert code == 1 and "未找到 skill" in output

    valid = root / "coding" / "sample"
    valid.mkdir(parents=True)
    (valid / "SKILL.md").write_text(
        "---\nname: sample\ndescription: Sample skill\nlicense: MIT\n---\n",
        encoding="utf-8",
    )
    assert validate(root) == (0, "validate: OK\n")

    incomplete = root / "coding" / "incomplete"
    incomplete.mkdir()
    code, output = validate(root)
    assert code == 1 and "incomplete: SKILL.md 缺失" in output
    assert "validate: FAIL" in output

print("PASS: missing root, empty root, valid skill, missing SKILL.md alongside valid skills")
