const fs = require('fs');
const js = fs.readFileSync(process.argv[1], 'utf-8');

const matches = new Set();
const regex = /"([^"]{4,150})"/g;
let m;
while ((m = regex.exec(js)) !== null) {
  const s = m[1];
  if (!/^[A-Z]/.test(s)) continue;
  if (!/[a-z]/.test(s)) continue;
  if (!/ /.test(s)) continue;
  // Exclude technical strings (avoid backslash in regex char class issues)
  if (/[{}();]/.test(s)) continue;
  if (/^(https?|ftp|file):/.test(s)) continue;
  if (/\.(js|ts|css|html|json|md|svg|png|jpg|gif|woff|ttf)/.test(s)) continue;
  if (/^(Error|TypeError|RangeError|SyntaxError|Reference|Assertion|Cannot|Attempt|Buffer|BigInt|Abstract|Already|Bad |Calling |An unknown)/.test(s)) continue;
  if (/^(Background|Border|Color|Foreground|Font|Outline|Widget)/.test(s)) continue;
  matches.add(s);
}

// Filter to likely UI strings
const uiWords = /\b(ask|send|attach|chat|session|permission|mode|plan|compact|accept|allow|approve|reject|retry|cancel|continue|stop|resume|search|clear|auth|login|logout|sign|token|usage|cost|model|tool|command|effort|context|work|project|status|message|conversation|history|thinking|mcp|connect|browser|filter|git|branch|diff|upload|download|share|copy|select|choose|open|close|save|delete|rename|move|install|update|account|profile|setting|keyboard|shortcut|theme|language|notif|toast|alert|confirm|prompt|input|output|result|response|server|client|proxy|api|endpoint|subscri|billing|payment|free|pro|team|enter|type|write|read|view|show|hide|display|render|format|tab|window|panel|sidebar|toolbar|menu|button|link|icon|image|scroll|zoom|resize|expand|collapse|previous|next|back|forward|edit|preview|review|submit|apply|revert|undo|redo|reset|restore|welcome|sorry|please|loading|generating|streaming|processing|analyzing|running|executing|waiting|pending|complete|finished|abort|timeout|claude|drag|drop|paste|file|folder|text|code|line|word|number|count|size|minimum|maximum|limit|range|change|toggle|enable|disable|active|click|double|right)\b/i;

const uiStrings = [...matches].filter(s => uiWords.test(s) && s.length <= 120);
uiStrings.sort();
uiStrings.forEach(s => console.log(JSON.stringify(s)));
console.error('Total: ' + uiStrings.length);
