const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

// 已知需要翻译的新发现的字符串
const newFound = [
  'What to do first? Ask about this codebase or we can start writing code.',
  'Click or drag to show more above',
  'Click or drag to show more below',
  'Click to collapse the range.',
  'Click to expand the range.',
  'Copy code to clipboard',
  'How can I do better? We would love to hear your feedback!',
  'Learn Claude Code',
  'Learn your next skill',
  'New session',
  'No matches. Try searching for something else.',
  'Open Claude Code Extension configuration',
  'Open Claude in Terminal',
  'Open a new Claude instance in the Terminal',
  'Open a new conversation in a new tab',
  'Open help documentation',
  'Open worktree',
  'Generating new name suggestions',
  'Generate new name suggestions',
  'Hide action widget',
  'No code actions available',
  'No preferred code actions available',
  'Code Workspace',
];

console.log('=== Checking new strings ===');
for (const s of newFound) {
  const found = js.includes('"' + s + '"');
  console.log(found ? '  FOUND:' : '  MISSING:', s);
}

// 搜索以 "What" 开头的字符串
console.log('\n=== All strings starting with "What" ===');
const whatRegex = /"What [^"]{3,120}"/g;
let m;
while ((m = whatRegex.exec(js)) !== null) {
  console.log('  ', m[0]);
}

// 搜索更多包含 "or" 的提示文字
console.log('\n=== Strings containing "or we" ===');
const orRegex = /"[^"]{5,120} or we [^"]{3,120}"/g;
while ((m = orRegex.exec(js)) !== null) {
  console.log('  ', m[0]);
}

// 搜索Learn/Try相关
console.log('\n=== Learn/Try strings ===');
const learnRegex = /"(Learn|Try|Get started|Ready)[^"]{3,80}"/g;
while ((m = learnRegex.exec(js)) !== null) {
  console.log('  ', m[0]);
}
