const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

const extra = [
  '"Add"',
  '"Adding…"',
  '". Click to change, or press Shift+Tab to cycle."',
  '". Click to change',
  'Click to change, or press Shift+Tab to cycle',
  '"Switched model"',
  '"Write a test for a recent change"',
  '"Explore the codebase and suggest a change"',
  '"Use Plan mode for complex changes"',
  '"Use planning mode to talk through big changes before a commit. Press"',
  '"Continue in Terminal to change output style?"',
  '"Restart Claude to apply plugin changes"',
  '"In Ask before editing mode, Claude will never change files without approval."',
];

for (const s of extra) {
  console.log(js.includes(s) ? 'FOUND:' : 'MISS:', s);
}
