console.log('check starts');
const fs = require('fs');
const code = fs.readFileSync('game.js', 'utf8');
let stack = [];
const pairs = {'{':'}','(':')','[':']'};
const reverse = {'}':'{', ')':'(', ']':'['};
let line = 1;
let col = 0;
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (c === '\n') { line++; col = 0; continue; }
  col++;
  if (c === '"' || c === "'" || c === '`') {
    let q = c;
    let j = i + 1;
    while (j < code.length) {
      if (code[j] === '\\') { j += 2; continue; }
      if (code[j] === q) { break; }
      if (code[j] === '\n') { line++; col = 0; } else col++;
      j++;
    }
    i = j;
    continue;
  }
  if (c === '/' && code[i+1] === '/') {
    while (i < code.length && code[i] !== '\n') i++;
    continue;
  }
  if (c === '/' && code[i+1] === '*') {
    i += 2;
    while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
      if (code[i] === '\n') { line++; col = 0; } else col+console.log('check starts');
const fs = require('fs');
const code = fs.rh(const fs = require('fs');
c econst code = fs.readFile  let stack = [];
const pairs = {'{':'}','(':')',1]const pairs = rsconst reverse = {'}':'{', ')':'(', ']':enlet line = 1;
let col = 0;
for (let i = 0; rslet col = 0;.lfor (let i ar  const c = code[i];
  if (c === '\ cons  if (c === '\n') {,   col++;
  if (c === '"' || c === "'" || c ===     if (c s    let q = c;
    let j = i + 1;
    whilele    let j = itack.length-1]);
