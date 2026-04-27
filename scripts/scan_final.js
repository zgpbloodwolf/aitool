const fs = require('fs');
const js = fs.readFileSync('C:/Users/YZS/.vscode/extensions/anthropic.claude-code-2.1.119-win32-x64/webview/index.js', 'utf-8');

// All candidate UI strings to check
const candidates = [
  // Tooltips & buttons
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
  'Ask Claude for help',
  'Ask Claude to edit…',
  'Attach file…',
  'Attach files from your computer',
  'Add files or folders to the conversation',
  'Add browser tabs to the conversation',

  // Modes panel
  'Modes',
  'Claude will ask for approval before making each edit',
  'Claude will edit your selected text or the whole file',
  'Claude will explore the code and present a plan before editing',
  'Claude will not ask for approval before running potentially dangerous commands',
  'Claude will automatically choose the best permission mode for each task',
  'Auto mode',
  'Ask before editing',
  'Select a mode',

  // Permissions
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

  // Status & actions
  'Accept this plan?',
  'Accept selected action',
  'Action completed',
  'An unexpected bug occurred.',
  'Something went wrong',
  'Thinking',
  'Checking code changes…',
  'Checking for quick fixes...',
  'Checking working directory',
  'Code rewind successful',
  'Rewind',
  'Resume conversation',
  'Retry',
  'Browse the web',
  'Click to expand',
  'Click to compact now.',
  'Click a position to set effort level',
  'Click to cycle effort level',

  // Account
  'Account & Usage',
  'Account & usage…',
  'API Key',
  'Authenticated successfully',
  'Authentication failed',
  'Clear authentication',
  'Bedrock, Foundry, or Vertex',

  // Conversation
  'New conversation',
  'Clear conversation',
  'Change the AI model',
  'Change response formatting style',
  'Adjust settings',
  'Open in browser',

  // Navigation / commands
  'Switch model…',

  // Claude branding
  'Claude AI',
  'Claude Code',
  'Claude’s Plan',
  'Claude may use instructions, code, or files from this skill.',

  // Placeholders & input
  'Describe the change you want...',
  'Tell Claude what to do instead',
  'Type your answer…',
  'Filter actions…',
  'Search sessions…',
  'Search plugins…',
  'Enter worktree name',
  'GitHub repo, URL, or path…',

  // MCP
  'MCP servers',
  'Loading MCP servers…',
  'Failed to load MCP servers',

  // Effort
  'Effort',
  'Compacted chat',
  'Effort: ',

  // Misc UI
  'On',
  'Off',
  'No results found',
  'Branch switch failed',
  'Check connection',
];

// Check which ones actually exist as string literals
const found = [];
const notFound = [];

for (const s of candidates) {
  const searchStr = '"' + s + '"';
  if (js.includes(searchStr)) {
    found.push(s);
  } else {
    // Try without trailing punctuation variations
    const variations = [
      s,
      s.replace('…', '...'),
      s.replace('...', '…'),
      s.replace('?', ''),
      s.replace(/:$/, ''),
    ];
    const anyFound = variations.some(v => js.includes('"' + v + '"'));
    if (anyFound) {
      found.push(s + ' (variant)');
    } else {
      notFound.push(s);
    }
  }
}

console.log('=== FOUND in index.js ===');
found.forEach(s => console.log('  "' + s + '"'));

console.log('\n=== NOT FOUND ===');
notFound.forEach(s => console.log('  "' + s + '"'));

console.log('\nTotal found:', found.length, '/ Total not found:', notFound.length);
