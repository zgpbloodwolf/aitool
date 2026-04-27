const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

// 搜索 "Add" 精确匹配的上下文
let idx = 0;
console.log('=== "Add" contexts ===');
while (true) {
  idx = js.indexOf('"Add"', idx);
  if (idx === -1) break;
  const start = Math.max(0, idx - 40);
  const end = Math.min(js.length, idx + 45);
  console.log('  ...' + js.substring(start, end).replace(/\n/g, '\n') + '...');
  idx += 5;
}

// 搜索 click to change
console.log('\n=== "click to change" ===');
idx = 0;
while (true) {
  idx = js.indexOf('click to change', idx);
  if (idx === -1) break;
  const start = Math.max(0, idx - 40);
  const end = Math.min(js.length, idx + 55);
  console.log('  ...' + js.substring(start, end).replace(/\n/g, '\n') + '...');
  idx += 16;
}

// 搜索 Click to change (大写)
console.log('\n=== "Click to change" ===');
idx = 0;
while (true) {
  idx = js.indexOf('Click to change', idx);
  if (idx === -1) break;
  const start = Math.max(0, idx - 40);
  const end = Math.min(js.length, idx + 55);
  console.log('  ...' + js.substring(start, end).replace(/\n/g, '\n') + '...');
  idx += 16;
}

// 搜索包含 change 的短字符串
console.log('\n=== Short strings with "change" ===');
const regex = /"([A-Z][a-z][^"]{3,80}[Cc]hange[^"]{0,40})"/g;
let m;
while ((m = regex.exec(js)) !== null) {
  console.log('  ', m[0]);
}

// 搜索 aria-label 或 title 中的 change
console.log('\n=== aria/title with "change" ===');
const r2 = /(?:aria-label|title)="([^"]*[Cc]hange[^"]*)"/g;
while ((m = r2.exec(js)) !== null) {
  console.log('  ', m[0]);
}

// 搜索 mode 相关的 tooltip
console.log('\n=== mode/Mode tooltip strings ===');
const r3 = /"[^"]{3,80}[Mm]ode[^"]{0,40}"/g;
while ((m = r3.exec(js)) !== null) {
  const s = m[0];
  if (s.length < 100 && /click|change|switch|hover/i.test(s)) {
    console.log('  ', s);
  }
}
