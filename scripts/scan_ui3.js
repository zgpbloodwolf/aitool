const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

// Known already-translated strings (skip these)
const alreadyTranslated = new Set([
  'Show command menu (/)',
  'Session history',
  'New chat',
  'Open in VS Code',
  'Send message',
  'Attach file',
  'Upload from computer',
  'Add context',
  '+ tab to switch',
  'Ask before edits',
  'Edit automatically',
  'Plan mode',
  'Bypass permissions',
  'Modes',
  'Claude will ask for approval before making each edit',
  'Claude will edit your selected text or the whole file',
  'Claude will explore the code and present a plan before editing',
  'Claude will not ask for approval before running potentially dangerous commands',
  'Ask Claude to edit…',
]);

// High-confidence Claude-specific UI strings to look for
const claudeSpecific = [
  'Accept this plan?',
  'Accept selected action',
  'Account & Usage',
  'Account & usage…',
  'Action completed',
  'Add files or folders to the conversation',
  'Add browser tabs to the conversation',
  'Adjust settings',
  'Allow fetching this url?',
  'Allow glob search in',
  'Allow grep in',
  'Allow network connection to this host?',
  'Allow reading from',
  'Allow searching for this query?',
  'Allow searching in',
  'Allow this bash command?',
  'Allow this glob command',
  'Allow this grep command',
  'Allow this search',
  'Allow write to',
  'Always allow',
  'Always allow for this session',
  'An unexpected bug occurred.',
  'API Key',
  'Ask before editing',
  'Ask Claude for help',
  'Attach files from your computer',
  'Attach file…',
  'Authenticated successfully',
  'Authentication failed',
  'Auto mode',
  'Bedrock, Foundry, or Vertex',
  'Branch checkout failed',
  'Branch switch failed',
  'Browse the web',
  'Cancel generating',
  'Change the AI model',
  'Change response formatting style',
  'Check connection',
  'Checking code changes…',
  'Checking for quick fixes...',
  'Checking working directory',
  'Clear authentication',
  'Clear conversation',
  'Click a position to set effort level',
  'Click to compact now.',
  'Click to cycle effort level',
  'Click to expand',
  'Claude AI',
  'Claude Code',
  'Claude may use instructions, code, or files from this skill.',
  'Claude will automatically choose the best permission mode for each task',
  'Claude’s Plan',
  'Code rewind successful',
  'Compact',
  'Compact now',
  'Connect to MCP server',
  'Continue generating',
  'Conversation compacted',
  'Drag and drop files here',
  'Effort level',
  'Enter API key',
  'Enter your API key',
  'Error connecting to MCP server',
  'Error loading',
  'Filter conversations',
  'High effort',
  'How to use',
  'Install extension',
  'Invalid API key',
  'Low effort',
  'Manage settings',
  'Max effort',
  'MCP server connected',
  'MCP server disconnected',
  'MCP server error',
  'Message sent',
  'New conversation',
  'No conversations found',
  'No results found',
  'Off',
  'On',
  'Open in browser',
  'Paste image or text',
  'Permission denied',
  'Plan accepted',
  'Plan rejected',
  'Please enter a message',
  'Rate limited',
  'Reject plan',
  'Retry',
  'Resume conversation',
  'Retry with',
  'Rewind',
  'Run command',
  'Search conversations',
  'Search history',
  'Select a mode',
  'Select model',
  'Send a message',
  'Settings saved',
  'Show command menu',
  'Sign in',
  'Sign in with',
  'Sign out',
  'Something went wrong',
  'Stop generating',
  'Switch model',
  'Thinking',
  'This response was interrupted',
  'Token limit',
  'Tool call',
  'Usage this month',
  'Use model',
  'View changes',
  'View diff',
  'View plan',
  'What can I help with?',
  'What would you like to do?',
  'Write a message',
  'You are offline',
  'Your account',
  'Your plan',
];

// Search for each string in the JS
const found = [];
for (const s of claudeSpecific) {
  if (alreadyTranslated.has(s)) continue;
  if (js.includes('"' + s + '"')) {
    found.push(s);
  }
}

// Also scan for patterns of short UI labels
const shortPatterns = [
  // aria-labels and titles
  /aria-label="([^"]{3,80})"/g,
  /title="([^"]{3,80})"/g,
  /placeholder="([^"]{3,80})"/g,
];

// Also find strings near known UI patterns in the minified code
const additionalFound = new Set();
// Search for tooltip-like patterns
const tooltipPattern = /\{"label":"([^"]{3,80})"/g;
let m;
while ((m = tooltipPattern.exec(js)) !== null) {
  const s = m[1];
  if (/^[A-Z]/.test(s) && /[a-z]/.test(s) && !alreadyTranslated.has(s)) {
    additionalFound.add(s);
  }
}

// Search for common placeholder patterns
const placeholderPattern = /placeholder:"([^"]{3,80})"/g;
while ((m = placeholderPattern.exec(js)) !== null) {
  const s = m[1];
  if (/^[A-Z]/.test(s) && /[a-z]/.test(s) && !alreadyTranslated.has(s)) {
    additionalFound.add(s);
  }
}

console.log('=== Claude-specific UI strings found ===');
found.forEach(s => console.log(s));
console.log('\n=== Additional tooltip/placeholder strings ===');
[...additionalFound].sort().forEach(s => console.log(s));
console.log('\n=== Not found (may need different search) ===');
claudeSpecific.filter(s => !found.includes(s) && !alreadyTranslated.has(s)).forEach(s => console.log(s));
