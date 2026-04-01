from pathlib import Path

text = Path("game.js").read_text()
brace = paren = bracket = 0
in_single = in_double = in_template = in_line_comment = in_block_comment = escape = (
    False
)
line = 1
for i, ch in enumerate(text):
    if ch == "\n":
        in_line_comment = False
        line += 1
    if in_line_comment:
        continue
    if in_block_comment:
        if ch == "*" and i + 1 < len(text) and text[i + 1] == "/":
            in_block_comment = False
        continue
    if escape:
        escape = False
        continue
    if in_single:
        if ch == "\\":
            escape = True
        elif ch == "'":
            in_single = False
        continue
    if in_double:
        if ch == "\\":
            escape = True
        elif ch == '"':
            in_double = False
        continue
    if in_template:
        if ch == "\\":
            escape = True
        elif ch == "`":
            in_template = False
        continue
    if ch == "/" and i + 1 < len(text):
        if text[i + 1] == "/":
            in_line_comment = True
            continue
        if text[i + 1] == "*":
            in_block_comment = True
            continue
    if ch == "'":
        in_single = True
        continue
    if ch == '"':
        in_double = True
        continue
    if ch == "`":
        in_template = True
        continue
    if ch == "{":
        brace += 1
    elif ch == "}":
        brace -= 1
    elif ch == "(":
        paren += 1
    elif ch == ")":
        paren -= 1
    elif ch == "[":
        bracket += 1
    elif ch == "]":
        bracket -= 1
    if line == 617:
        print("617", brace, paren, bracket)
    if line == 3834:
        print("3834", brace, paren, bracket)
print("final", line, brace, paren, bracket)
