const fs = require("fs");
const code = fs.readFileSync("game.js", "utf8");
let stack = [];
const pairs = { "{": "}", "(": ")", "[": "]" };
const reverse = { "}": "{", ")": "(", "]": "[" };
let line = 1;
let col = 0;
let mismatch = null;
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (c === "\n") {
    line++;
    col = 0;
    continue;
  }
  col++;
  if (c === '"' || c === "'" || c === "`") {
    const q = c;
    let j = i + 1;
    while (j < code.length) {
      if (code[j] === "\\") {
        j += 2;
        continue;
      }
      if (code[j] === q) {
        break;
      }
      if (code[j] === "\n") {
        line++;
        col = 0;
      } else col++;
      j++;
    }
    i = j;
    continue;
  }
  if (c === "/" && code[i + 1] === "/") {
    while (i < code.length && code[i] !== "\n") i++;
    line++;
    col = 0;
    continue;
  }
  if (c === "/" && code[i + 1] === "*") {
    i += 2;
    while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
      if (code[i] === "\n") {
        line++;
        col = 0;
      } else col++;
      i++;
    }
    i++;
    continue;
  }
  if (pairs[c]) stack.push({ char: c, line, col, idx: i });
  else if (reverse[c]) {
    if (stack.length === 0 || stack[stack.length - 1].char !== reverse[c]) {
      mismatch = {
        type: "closing",
        expected:
          stack.length === 0 ? null : pairs[stack[stack.length - 1].char],
        found: c,
        line,
        col,
        idx: i,
      };
      break;
    }
    stack.pop();
  }
}
if (!mismatch && stack.length > 0)
  mismatch = {
    type: "unclosed",
    stackTop: stack[stack.length - 1],
    remaining: stack.length,
  };
console.log("mismatch", mismatch);
