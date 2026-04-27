const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

const moreStrings = [
  'What does this code do?',
  'Learn your next skill →',
  'Ready to code?',
  'Learn more about MCP',
  'Try something like:',
  'Open Link',
  'Open Definition to the Side',
  'Open Accessible Diff Viewer',
  'Open to the Bottom',
  'Open to the Side',
  'Open a text editor first to go to a line.',
  'No type definition found',
  'Enter a task description',
  'Describe what you want to build',
  'How can I help?',
  'How can Claude help?',
  'Ask me anything',
  'Type a message',
  'Write your message',
  'What would you like?',
  'Enter your prompt',
  'Ask a follow up',
  'Ask a follow-up',
  'Continue the conversation',
  'Suggested prompts',
  'Quick actions',
  'Pro tip',
  'Pro tips',
  'Keyboard shortcuts',
  'Recent files',
  'Recent conversations',
  'Pinned conversations',
  'Starred',
  'Unstarred',
  'Archive',
  'Archived',
  'Delete',
  'Rename',
  'Duplicate',
  'Export',
  'Import',
];

console.log('=== Checking ===');
for (const s of moreStrings) {
  if (js.includes('"' + s + '"')) {
    console.log('  FOUND:', s);
  }
}

// 也搜索一些特定模式
console.log('\n=== "Ask a" pattern ===');
const r1 = /"Ask a[^"]{3,60}"/g;
let m;
while ((m = r1.exec(js)) !== null) console.log('  ', m[0]);

console.log('\n=== "How can" pattern ===');
const r2 = /"How can[^"]{3,80}"/g;
while ((m = r2.exec(js)) !== null) console.log('  ', m[0]);

console.log('\n=== "Ready" pattern ===');
const r3 = /"Ready[^"]{3,80}"/g;
while ((m = r3.exec(js)) !== null) console.log('  ', m[0]);

console.log('\n=== "Type a" pattern ===');
const r4 = /"Type a[^"]{3,60}"/g;
while ((m = r4.exec(js)) !== null) console.log('  ', m[0]);

console.log('\n=== "Suggested" pattern ===');
const r5 = /"Suggested[^"]{3,60}"/g;
while ((m = r5.exec(js)) !== null) console.log('  ', m[0]);

console.log('\n=== "Quick" pattern (short) ===');
const r6 = /"Quick [^"]{3,60}"/g;
while ((m = r6.exec(js)) !== null) console.log('  ', m[0]);

console.log('\n=== "Pro tip" pattern ===');
const r7 = /"Pro tip[^"]{0,60}"/g;
while ((m = r7.exec(js)) !== null) console.log('  ', m[0]);

// 搜索带 → 的字符串
console.log('\n=== Arrow → strings ===');
const r8 = /"[^"]{3,80}→[^"]{0,60}"/g;
while ((m = r8.exec(js)) !== null) console.log('  ', m[0]);

// Compact 相关
console.log('\n=== Compact strings ===');
const r9 = /"[^"]*[Cc]ompact[^"]{0,60}"/g;
while ((m = r9.exec(js)) !== null) console.log('  ', m[0]);
