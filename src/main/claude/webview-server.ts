import { createServer, type Server } from 'http'
import { readFile, stat } from 'fs/promises'
import { join, extname } from 'path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

let server: Server | null = null
let serverPort = 0

export async function startWebviewServer(extensionPath: string): Promise<number> {
  if (server) return serverPort

  return new Promise((resolve, reject) => {
    server = createServer(async (req, res) => {
      const url = req.url?.split('?')[0] || '/'
      console.log(`[Webview服务器] ${req.method} ${url}`)

      try {
        if (url === '/' || url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(generateHostHtml(extensionPath))
          return
        }

        // Serve files from extension webview directory
        const filePath = join(extensionPath, 'webview', url)
        const fileStat = await stat(filePath)
        if (!fileStat.isFile()) {
          console.warn(`[Webview服务器] 不是文件: ${filePath}`)
          res.writeHead(404)
          res.end('未找到')
          return
        }

        const data = await readFile(filePath)
        const ext = extname(filePath)
        const contentType = MIME_TYPES[ext] || 'application/octet-stream'
        console.log(`[Webview服务器] 正在提供 ${filePath} (${contentType}, ${data.length} 字节)`)
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(data)
      } catch (err) {
        console.error(`[Webview服务器] 提供文件出错 ${url}:`, err)
        res.writeHead(404)
        res.end('未找到')
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      if (addr && typeof addr === 'object') {
        serverPort = addr.port
        resolve(serverPort)
      } else {
        reject(new Error('获取服务器端口失败'))
      }
    })

    server.on('error', reject)
  })
}

export function stopWebviewServer(): void {
  if (server) {
    server.close()
    server = null
    serverPort = 0
  }
}

function generateHostHtml(_extensionPath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' data: blob:; img-src 'self' data: blob: https:; font-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' http://127.0.0.1:* blob: data: ws://localhost:*;">
  <title>Claude Code</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body { background: #1e1e2e; color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    /* VSCode CSS variable overrides for standalone mode */
    :root {
      --vscode-input-background: #313244;
      --vscode-input-foreground: #cdd6f4;
      --vscode-input-border: #45475a;
      --vscode-input-placeholderForeground: #6c7086;
      --vscode-focusBorder: #89b4fa;
      --vscode-inputOption-activeBorder: #89b4fa;
      --vscode-editor-background: #1e1e2e;
      --vscode-editor-foreground: #cdd6f4;
      --vscode-sideBar-background: #181825;
      --vscode-activityBar-background: #11111b;
      --vscode-titleBar-activeForeground: #cdd6f4;
      --vscode-titleBar-inactiveForeground: #6c7086;
      --vscode-badge-background: #89b4fa;
      --vscode-badge-foreground: #1e1e2e;
      --vscode-button-background: #89b4fa;
      --vscode-button-foreground: #1e1e2e;
      --vscode-button-hoverBackground: #74c7ec;
      --vscode-scrollbarSlider-background: #45475a80;
      --vscode-scrollbarSlider-hoverBackground: #585b7080;
      --vscode-list-hoverBackground: #313244;
      --vscode-list-activeSelectionBackground: #45475a;
      --vscode-list-activeSelectionForeground: #cdd6f4;
      --vscode-dropdown-background: #313244;
      --vscode-dropdown-border: #45475a;
      --vscode-dropdown-foreground: #cdd6f4;
      --vscode-menu-background: #313244;
      --vscode-menu-foreground: #cdd6f4;
      --vscode-menu-border: #45475a;
      --vscode-menu-selectionBackground: #45475a;
      --vscode-menu-selectionForeground: #cdd6f4;
      --vscode-notifications-background: #313244;
      --vscode-notifications-foreground: #cdd6f4;
      --vscode-notifications-border: #45475a;
    }
  </style>
  <link rel="stylesheet" href="/index.css">
  <script>
    // acquireVsCodeApi shim - bridges webview messages to Electron IPC
    window.acquireVsCodeApi = (function() {
      let state = {};
      let api = null;

      // Receive messages FROM main process
      window.addEventListener('message', function(event) {
        // Forward claude-webview messages to the webview's internal listener
        // The webview expects: { type: "from-extension", message: {...} }
      });

      // Session history trigger from parent frame button
      // Arrives via main process as: { type: 'from-extension', message: { type: 'trigger_session_history' } }
      window.addEventListener('message', function(event) {
        var data = event.data;
        var msgType = data && data.type === 'from-extension' && data.message ? data.message.type : (data && data.type);
        if (msgType !== 'trigger_session_history') return;

        setTimeout(function() {
          // Approach 1: Click the built-in "Session history" clock button
          var btn = document.querySelector('[aria-label="Session history"]') || document.querySelector('[aria-label="会话历史"]');
          if (btn) { btn.click(); return; }

          // Approach 2: Walk React fiber tree to find commandRegistry
          var root = document.getElementById('root');
          if (!root) return;
          var fk = Object.keys(root).find(function(k) {
            return k.startsWith('__reactFiber') || k.startsWith('__reactContainer') || k.startsWith('__reactInternalInstance');
          });
          if (!fk) return;

          var queue = [root[fk]];
          var visited = new Set();
          while (queue.length > 0) {
            var f = queue.shift();
            if (!f || visited.has(f)) continue;
            visited.add(f);
            try {
              if (f.memoizedProps && f.memoizedProps.context && f.memoizedProps.context.commandRegistry && f.memoizedProps.context.commandRegistry.commandActions) {
                f.memoizedProps.context.commandRegistry.executeCommand('resume-conversation');
                return;
              }
            } catch(e) {}
            if (f.child) queue.push(f.child);
            if (f.sibling) queue.push(f.sibling);
            if (f.stateNode && f.stateNode.props && f.stateNode.props.context) {
              try {
                var ctx = f.stateNode.props.context;
                if (ctx.commandRegistry && ctx.commandRegistry.executeCommand) {
                  ctx.commandRegistry.executeCommand('resume-conversation');
                  return;
                }
              } catch(e) {}
            }
          }
        }, 300);
      });

      // Listen for messages from main process via IPC bridge
      // These arrive as custom events from the parent frame
      window.addEventListener('claude-incoming', function(event) {
        const detail = event.detail;
        window.postMessage({ type: 'from-extension', message: detail }, '*');
      });

      api = {
        postMessage(msg) {
          // Send to parent window (ChatPanel iframe host)
          window.parent.postMessage({ type: 'claude-webview-message', message: msg }, '*');
        },
        getState() {
          return state;
        },
        setState(newState) {
          state = newState;
        }
      };

      return function() {
        if (window._vscodeApi) return window._vscodeApi;
        window._vscodeApi = api;
        return api;
      };
    })();

    // Window globals expected by Claude Code webview
    window.IS_FULL_EDITOR = true;
    window.IS_SIDEBAR = false;
    window.IS_ANT = false;
    window.IS_SESSION_LIST_ONLY = false;
  </script>
</head>
<body>
  <div id="root" data-initial-auth-status="null"></div>
  <script src="/index.js"></script>
  <script>
    // Context usage percentage badge — injected next to "Show command menu" button
    (function() {
      var CONTEXT_USABLE = 128000 - 13000 - 16384;
      var usedTokens = 0;

      // Track token usage from stream events forwarded by main process
      window.addEventListener('message', function(e) {
        var data = e.data;
        if (!data || data.type !== 'from-extension') return;
        var msg = data.message && data.message.message ? data.message.message : null;
        if (!msg || msg.type !== 'stream_event' || !msg.event) return;
        var usage = msg.event.usage;
        if (!usage) return;
        var total = (usage.input_tokens || 0) + (usage.output_tokens || 0);
        if (total > 0) usedTokens = total;
        updateBadge();
      });

      var badge = null;
      var inserted = false;

      function updateBadge() {
        if (usedTokens === 0) return;
        var pct = Math.min(100, Math.round((usedTokens / CONTEXT_USABLE) * 100));
        if (!badge) {
          badge = document.createElement('span');
          badge.style.cssText = 'font-size:11px;padding:1px 7px;border-radius:3px;margin-left:4px;font-weight:600;cursor:default;flex-shrink:0;vertical-align:middle;';
        }
        badge.textContent = pct + '%';
        if (pct > 90) {
          badge.style.background = 'rgba(243,139,168,0.2)';
          badge.style.color = '#f38ba8';
        } else if (pct > 70) {
          badge.style.background = 'rgba(249,226,175,0.2)';
          badge.style.color = '#f9e2af';
        } else {
          badge.style.background = 'rgba(137,180,250,0.15)';
          badge.style.color = '#89b4fa';
        }

        if (!inserted) {
          insertBadge();
        }
      }

      // Translate webview toolbar tooltips to Chinese
      var TOOLTIP_MAP = {
        'Show command menu (/)': '显示命令菜单 (/)',
        'Session history': '会话历史',
        'New chat': '新建对话',
        'Open in VS Code': '在 VS Code 中打开',
        'Settings': '设置',
        'Send message': '发送消息',
        'Attach file': '附加文件',
        'Add': '添加'
      };
      // Menu text translations (dynamically rendered content)
      var TEXT_MAP = {
        'Upload from computer': '从本地上传',
        'Add context': '添加上下文',
        'Modes': '模式',
        '+ tab to switch': '+ Tab 切换',
        'Ask before edits': '编辑前询问',
        'Claude will ask for approval before making each edit': 'Claude 会在每次编辑前请求您的批准',
        'Edit automatically': '自动编辑',
        'Claude will edit your selected text or the whole file': 'Claude 会编辑您选中的文本或整个文件',
        'Plan mode': '计划模式',
        'Claude will explore the code and present a plan before editing': 'Claude 会在编辑前分析代码并提出方案',
        'Bypass permissions': '跳过权限确认',
        'Claude will not ask for approval before running potentially dangerous commands': 'Claude 会在运行潜在危险命令前不再请求批准'
      };
      function translateTooltips() {
        Object.keys(TOOLTIP_MAP).forEach(function(en) {
          var zh = TOOLTIP_MAP[en];
          document.querySelectorAll('[title="' + en + '"]').forEach(function(el) { el.title = zh; });
          document.querySelectorAll('[aria-label="' + en + '"]').forEach(function(el) { el.setAttribute('aria-label', zh); });
        });
        // Translate dynamic menu text nodes
        Object.keys(TEXT_MAP).forEach(function(en) {
          var zh = TEXT_MAP[en];
          var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          while (walker.nextNode()) {
            if (walker.currentNode.textContent.trim() === en) {
              walker.currentNode.textContent = zh;
            }
          }
        });
      }

      function insertBadge() {
        var btn = document.querySelector('[title="显示命令菜单 (/)"]') || document.querySelector('[title="Show command menu (/)"]');
        if (!btn || !btn.parentElement) return;
        // Insert right after the command menu button
        if (btn.nextSibling && btn.nextSibling !== badge) {
          btn.parentElement.insertBefore(badge, btn.nextSibling);
        } else if (!btn.nextSibling) {
          btn.parentElement.appendChild(badge);
        }
        inserted = true;
      }

      // Watch for dynamically added menu content (React renders on click)
      var textObserver = new MutationObserver(function(mutations) {
        var changed = false;
        mutations.forEach(function(m) {
          m.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
              changed = true;
            }
          });
        });
        if (changed) translateTooltips();
      });
      textObserver.observe(document.body, { childList: true, subtree: true });

      // Retry insertion periodically (React may re-render the toolbar)
      setInterval(function() {
        translateTooltips();
        if (badge && !document.contains(badge)) {
          inserted = false;
          insertBadge();
        }
      }, 2000);
    })();
  </script>
</body>
</html>`
}
