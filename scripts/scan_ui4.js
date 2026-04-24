const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

// Search for missing strings with fuzzy matching
const missing = [
  'Always allow',
  'Compact',
  'Compact now',
  'Continue generating',
  'Drag and drop',
  'Effort',
  'Enter API',
  'Filter conversation',
  'High effort',
  'How to use',
  'Install extension',
  'Invalid API',
  'Low effort',
  'Manage setting',
  'Max effort',
  'MCP',
  'Message sent',
  'No conversation',
  'Paste image',
  'Permission denied',
  'Plan accept',
  'Plan reject',
  'Rate limit',
  'Reject plan',
  'Retry with',
  'Run command',
  'Search conversation',
  'Search history',
  'Select a mode',
  'Select model',
  'Send a message',
  'Settings saved',
  'Sign in',
  'Sign out',
  'Stop generating',
  'Switch model',
  'This response was interrupted',
  'Token limit',
  'Tool call',
  'Usage this month',
  'Use model',
  'View changes',
  'View diff',
  'View plan',
  'What can I help',
  'What would you like',
  'Write a message',
  'You are offline',
  'Your account',
  'Your plan',
  'Cancel',
  'New conversation',
  'Drag',
  'drop',
  'Paste',
];

for (const query of missing) {
  // Search with surrounding context
  let idx = 0;
  const results = [];
  while (true) {
    idx = js.indexOf(query, idx);
    if (idx === -1) break;
    // Get surrounding context
    const start = Math.max(0, idx - 30);
    const end = Math.min(js.length, idx + query.length + 30);
    const ctx = js.substring(start, end);
    // Only show if it looks like a string literal
    if (ctx.includes('"') || ctx.includes("'")) {
      results.push(ctx.replace(/\n/g, '\n'));
    }
    idx += query.length;
    if (results.length >= 3) break;
  }
  if (results.length > 0) {
    console.log(`\n--- "${query}" ---`);
    results.forEach(r => console.log('  ', r));
  }
}
