const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

// 找出所有短字符串（2-50字符）包含常见UI词汇
const keywords = ['What', 'How', 'Ask', 'Get', 'Start', 'Try', 'Use', 'Learn', 'Set', 'Run',
  'New', 'Open', 'Close', 'Send', 'Save', 'Share', 'Copy', 'Paste', 'Delete',
  'Click', 'Type', 'Enter', 'Select', 'Choose', 'Search', 'Find', 'Filter',
  'Add', 'Remove', 'Edit', 'View', 'Show', 'Hide', 'Toggle', 'Change',
  'Build', 'Create', 'Generate', 'Write', 'Read', 'Load', 'Download',
  'Welcome', 'Hello', 'Good', 'Ready', 'Done', 'Finish', 'Complete',
  'Cancel', 'Accept', 'Reject', 'Deny', 'Approve', 'Allow', 'Block',
  'Enable', 'Disable', 'Turn', 'Switch', 'Upgrade', 'Install',
  'Upload', 'Attach', 'Drag', 'Drop', 'Scroll', 'Expand', 'Collapse',
  'Previous', 'Next', 'Back', 'Forward', 'Continue', 'Skip',
  'Loading', 'Saving', 'Processing', 'Analyzing', 'Generating', 'Running',
  'Please', 'Sorry', 'Thank', 'Welcome', 'Oops', 'Oops',
  'File', 'Folder', 'Project', 'Workspace', 'Repo', 'Branch', 'Commit',
  'Code', 'Text', 'Image', 'Link', 'Video', 'Audio',
  'Chat', 'Message', 'Reply', 'Response', 'Prompt', 'Input',
  'Tool', 'Plugin', 'Extension', 'Theme', 'Language', 'Font',
  'Model', 'Token', 'Usage', 'Limit', 'Cost', 'Plan',
  'Today', 'Yesterday', 'Last', 'Recent', 'Previous',
  'Tip', 'Help', 'Hint', 'Info', 'Warning', 'Error',
  'Yes', 'No', 'OK', 'Sure', 'Not', 'Now',
  'Claude', 'VS Code', 'Terminal', 'Browser', 'Git'];

const matches = new Set();
const regex = /"([^"]{3,120})"/g;
let m;
while ((m = regex.exec(js)) !== null) {
  const s = m[1];
  if (!/^[A-Z]/.test(s)) continue;
  if (!/[a-z]/.test(s)) continue;
  if (!/ /.test(s)) continue;
  if (/[{}();]/.test(s)) continue;
  if (/^(https?|ftp|file):/.test(s)) continue;
  if (/\.(js|ts|css|html|json|md|svg|png|jpg)/.test(s)) continue;
  if (/^(Error|TypeError|RangeError|SyntaxError|Reference|Assertion|Cannot|Attempt|Buffer|BigInt|Abstract|Already|Bad |Calling |An unknown)/.test(s)) continue;
  if (/^(Background|Border|Color|Foreground|Font|Outline|Widget)/.test(s)) continue;
  
  const startsWithKw = keywords.some(kw => s.startsWith(kw));
  if (startsWithKw) matches.add(s);
}

[...matches].sort().forEach(s => console.log(JSON.stringify(s)));
console.error('Total:', matches.size);
