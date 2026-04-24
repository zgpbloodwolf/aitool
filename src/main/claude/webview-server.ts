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
          var btn = document.querySelector('[aria-label="Session history"]');
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
</body>
</html>`
}
