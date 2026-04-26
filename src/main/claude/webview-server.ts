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

/** 当前 resolved 主题，用于 webview HTML 生成 */
let currentTheme: 'dark' | 'light' = 'dark'

/** 更新 webview 主题 — 由主进程调用 */
export function setWebviewTheme(theme: 'dark' | 'light'): void {
  currentTheme = theme
}

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
        // Source-level i18n: replace English strings in JS before serving
        const served = ext === '.js' ? patchI18n(data) : data
        console.log(`[Webview服务器] 正在提供 ${filePath} (${contentType}, ${served.length} 字节)`)
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(served)
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

// Source-level i18n: replace English strings in webview JS with Chinese
const I18N_REPLACEMENTS: [RegExp | string, string][] = [
  // 工具提示 & aria-label
  ['"Show command menu (/)"', '"显示命令菜单 (/)"'],
  ['"Session history"', '"会话历史"'],
  ['"New chat"', '"新建对话"'],
  ['"Open in VS Code"', '"在 VS Code 中打开"'],
  ['"Send message"', '"发送消息"'],
  ['"Attach file"', '"附加文件"'],
  ['"Ask Claude for help"', '"请 Claude 帮助"'],
  ['"Attach file…"', '"附加文件…"'],
  ['"Attach files from your computer"', '"从电脑附加文件"'],
  ['"Add files or folders to the conversation"', '"添加文件或文件夹到对话"'],
  ['"Add browser tabs to the conversation"', '"添加浏览器标签到对话"'],
  ['"Click to expand"', '"点击展开"'],
  ['"Click to compact now."', '"点击立即压缩。"'],
  ['"Click a position to set effort level"', '"点击设置努力程度"'],
  ['"Click to cycle effort level"', '"点击切换努力程度"'],
  ['"Open in browser"', '"在浏览器中打开"'],
  ['"Browse the web"', '"浏览网页"'],

  // 菜单项
  ['"Upload from computer"', '"从本地上传"'],
  ['"Add context"', '"添加上下文"'],

  // 模式面板
  ['"+ tab to switch"', '"+ Tab 切换"'],
  ['"Ask before edits"', '"编辑前询问"'],
  ['"Edit automatically"', '"自动编辑"'],
  ['"Plan mode"', '"计划模式"'],
  ['"Bypass permissions"', '"跳过权限确认"'],
  ['"Modes"', '"模式"'],
  ['"Auto mode"', '"自动模式"'],
  ['"Ask before editing"', '"编辑前询问"'],
  ['"Claude will ask for approval before making each edit"', '"Claude 会在每次编辑前请求您的批准"'],
  ['"Claude will edit your selected text or the whole file"', '"Claude 会编辑您选中的文本或整个文件"'],
  ['"Claude will explore the code and present a plan before editing"', '"Claude 会在编辑前分析代码并提出方案"'],
  ['"Claude will not ask for approval before running potentially dangerous commands"', '"Claude 会在运行潜在危险命令前不再请求批准"'],
  ['"Claude will automatically choose the best permission mode for each task"', '"Claude 会为每个任务自动选择最佳权限模式"'],

  // 权限请求
  ['"Allow fetching this url?"', '"允许获取此 URL？"'],
  ['"Allow glob search in"', '"允许在此路径搜索"'],
  ['"Allow grep in"', '"允许在此路径搜索"'],
  ['"Allow network connection to this host?"', '"允许连接到此主机？"'],
  ['"Allow reading from"', '"允许读取"'],
  ['"Allow searching for this query?"', '"允许搜索此查询？"'],
  ['"Allow searching in"', '"允许在此路径搜索"'],
  ['"Allow this bash command?"', '"允许此 bash 命令？"'],
  ['"Allow this glob command"', '"允许此 glob 命令"'],
  ['"Allow this grep command"', '"允许此 grep 命令"'],
  ['"Allow this search"', '"允许此搜索"'],
  ['"Allow write to"', '"允许写入"'],

  // 状态 & 操作
  ['"Accept this plan?"', '"接受此方案？"'],
  ['"Accept selected action"', '"接受选中的操作"'],
  ['"Action completed"', '"操作完成"'],
  ['"An unexpected bug occurred."', '"发生了意外错误。"'],
  ['"Something went wrong"', '"出了点问题"'],
  ['"Thinking"', '"思考中"'],
  ['"Checking code changes…"', '"正在检查代码更改…"'],
  ['"Checking for quick fixes..."', '"正在检查快速修复..."'],
  ['"Checking working directory"', '"正在检查工作目录"'],
  ['"Code rewind successful"', '"代码回退成功"'],
  ['"Rewind"', '"回退"'],
  ['"Resume conversation"', '"恢复对话"'],
  ['"Retry"', '"重试"'],
  ['"On"', '"开"'],
  ['"Off"', '"关"'],
  ['"No results found"', '"未找到结果"'],
  ['"Branch switch failed"', '"分支切换失败"'],
  ['"Check connection"', '"检查连接"'],
  ['"Effort"', '"努力程度"'],

  // 账户
  ['"Account & Usage"', '"账户与用量"'],
  ['"Account & usage…"', '"账户与用量…"'],
  ['"API Key"', '"API 密钥"'],
  ['"Authenticated successfully"', '"认证成功"'],
  ['"Authentication failed"', '"认证失败"'],
  ['"Clear authentication"', '"清除认证"'],
  ['"Bedrock, Foundry, or Vertex"', '"Bedrock、Foundry 或 Vertex"'],

  // 对话
  ['"New conversation"', '"新建对话"'],
  ['"Clear conversation"', '"清除对话"'],
  ['"Change the AI model"', '"更改 AI 模型"'],
  ['"Change response formatting style"', '"更改回复格式"'],
  ['"Adjust settings"', '"调整设置"'],
  ['"Switch model…"', '"切换模型…"'],

  // Claude 品牌
  ['"Claude\'s Plan"', '"Claude 的方案"'],
  ['"Claude may use instructions, code, or files from this skill."', '"Claude 可能使用此技能中的指令、代码或文件。"'],

  // 输入提示
  ['"Ask Claude to edit…"', '"请 Claude 编辑…"'],
  ['"Ask Claude to edit..."', '"请 Claude 编辑..."'],
  ['"Describe the change you want..."', '"描述你想要的更改..."'],
  ['"Tell Claude what to do instead"', '"告诉 Claude 改做什么"'],
  ['"Type your answer…"', '"输入你的回答…"'],
  ['"Filter actions…"', '"筛选操作…"'],
  ['"Search sessions…"', '"搜索会话…"'],
  ['"Search plugins…"', '"搜索插件…"'],
  ['"Enter worktree name"', '"输入工作树名称"'],
  ['"GitHub repo, URL, or path…"', '"GitHub 仓库、URL 或路径…"'],

  // MCP
  ['"MCP servers"', '"MCP 服务器"'],
  ['"Loading MCP servers…"', '"正在加载 MCP 服务器…"'],
  ['"Failed to load MCP servers"', '"加载 MCP 服务器失败"'],
  ['"Learn more about MCP"', '"了解更多关于 MCP"'],

  // 欢迎文字 & 提示
  ['"What to do first? Ask about this codebase or we can start writing code."', '"首先做什么？询问此代码库，或者我们可以开始编写代码。"'],
  ['"What does this code do?"', '"这段代码做什么？"'],
  ['"Ready to code?"', '"准备好编码了吗？"'],
  ['"Try something like:"', '"试试这样的提示："'],
  ['"Learn Claude Code"', '"学习 Claude Code"'],
  ['"Learn your next skill →"', '"学习下一个技能 →"'],
  ['"How can I do better? We would love to hear your feedback!"', '"我怎样才能做得更好？期待您的反馈！"'],
  ['"Compacted chat · "', '"已压缩对话 · "'],
  ['"Conversation was compacted to free up context."', '"对话已压缩以释放上下文空间。"'],
  ['"% of context remaining until auto-compact."', '"% 剩余上下文，即将自动压缩。"'],
  ['"Compacting"', '"正在压缩"'],
  ['"New session"', '"新建会话"'],
  ['"Open worktree"', '"打开工作树"'],
  ['"Open Claude in Terminal"', '"在终端中打开 Claude"'],
  ['"Open a new Claude instance in the Terminal"', '"在终端中打开新的 Claude 实例"'],
  ['"Open a new conversation in a new tab"', '"在新标签页中打开新对话"'],
  ['"Open Claude Code Extension configuration"', '"打开 Claude Code 扩展配置"'],
  ['"Open help documentation"', '"打开帮助文档"'],
  ['"Copy code to clipboard"', '"复制代码到剪贴板"'],
  ['"Click or drag to show more above"', '"点击或拖动以显示上方更多内容"'],
  ['"Click or drag to show more below"', '"点击或拖动以显示下方更多内容"'],
  ['"Click to collapse the range."', '"点击折叠此范围。"'],
  ['"Click to expand the range."', '"点击展开此范围。"'],
  ['"No matches. Try searching for something else."', '"无匹配结果。请尝试搜索其他内容。"'],
  ['"Hide action widget"', '"隐藏操作小部件"'],
  ['"Delete"', '"删除"'],

  // "+" 按钮 & Adding
  ['"Add"', '"添加"'],
  ['"Adding…"', '"添加中…"'],

  // 模式切换 tooltip（模板字符串内的片段）
  [/Click to change, or press Shift\+Tab to cycle/g, '点击切换，或按 Shift+Tab 循环切换'],

  // 更多命令面板 & 提示文字
  ['"Switched model"', '"已切换模型"'],
  ['"Write a test for a recent change"', '"为最近的更改编写测试"'],
  ['"Explore the codebase and suggest a change"', '"探索代码库并建议更改"'],
  ['"Use Plan mode for complex changes"', '"对复杂更改使用计划模式"'],
  ['"Use planning mode to talk through big changes before a commit. Press"', '"在提交前使用计划模式讨论重大更改。按"'],
  ['"Continue in Terminal to change output style?"', '"在终端中继续以更改输出风格？"'],
  ['"Restart Claude to apply plugin changes"', '"重启 Claude 以应用插件更改"'],
  ['"In Ask before editing mode, Claude will never change files without approval."', '"在编辑前询问模式下，Claude 未经批准不会更改文件。"'],
]

function patchI18n(data: Buffer): Buffer {
  let js = data.toString('utf-8')
  for (const [from, to] of I18N_REPLACEMENTS) {
    js = js.replaceAll(from, to)
  }
  return Buffer.from(js, 'utf-8')
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
          var btn = document.querySelector('[aria-label="会话历史"]');
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

      function insertBadge() {
        var btn = document.querySelector('[title="显示命令菜单 (/)"]');
        if (!btn || !btn.parentElement) return;
        if (btn.nextSibling && btn.nextSibling !== badge) {
          btn.parentElement.insertBefore(badge, btn.nextSibling);
        } else if (!btn.nextSibling) {
          btn.parentElement.appendChild(badge);
        }
        inserted = true;
      }

      // Retry badge insertion periodically (React may re-render the toolbar)
      setInterval(function() {
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
