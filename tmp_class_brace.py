from pathlib import Path

text = Path("game.js").read_text().splitlines()
start_line = 617 - 1
in_single = False
in_double = False
in_template = False
in_line_comment = False
in_block_comment = False
escape = False
class_depth = 0
brace = 0
line_num = 0
for i, line in enumerate(text):
    if i < start_line:
        continue
    line_num = i + 1
    j = 0
    while j < len(line):
        ch = line[j]
        if in_line_comment:
            break
        if in_block_comment:
            if ch == "*" and j + 1 < len(line) and line[j + 1] == "/":
                in_block_comment = False
                j += 1
            j += 1
            continue
        if escape:
            escape = False
            j += 1
            continue
        if in_single:
            if ch == "\\":
                escape = True
            elif ch == "'":
                in_single = False
            j += 1
            continue
        if in_double:
            if ch == "\\":
                escape = True
            elif ch == '"':
                in_double = False
            j += 1
            continue
        if in_template:
            if ch == "\\":
                escape = True
            elif ch == "`":
                in_template = False
            j += 1
            continue
        if ch == "/" and j + 1 < len(line):
            if line[j + 1] == "/":
                in_line_comment = True
                break
            if line[j + 1] == "*":
                in_block_comment = True
                j += 2
                continue
        if ch == "'":
            in_single = True
            j += 1
            continue
        if ch == '"':
            in_double = True
            j += 1
            continue
        if ch == "`":
            in_template = True
            j += 1
            continue
        if ch == "{":
            brace += 1
            if class_depth > 0:
                class_depth += 1
            elif "class LobbyScene" in line:
                class_depth = 1
            else:
                pass
        elif ch == "}":
            brace -= 1
            if class_depth > 0:
                class_depth -= 1
                if class_depth == 0:
                    print("class closed at line", line_num)
        j += 1
    if line_num == 3834 or line_num == 3832:
        print("line", line_num, "brace", brace, "class_depth", class_depth)

print("final brace", brace, "class_depth", class_depth)
