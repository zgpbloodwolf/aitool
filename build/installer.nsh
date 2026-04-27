; Windows 右键菜单集成 (UX-10)
; 文件夹右键 + 文件夹背景右键，不含驱动器右键 (D-10)

!macro customInstall
  ; 文件夹右键菜单
  WriteRegStr SHCTX "Software\Classes\Directory\shell\ai-tools" "" "使用 AI Tools 打开"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\ai-tools" "Icon" "$INSTDIR\ai-tools.exe"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\ai-tools\command" "" '"$INSTDIR\ai-tools.exe" "%V"'

  ; 目录背景右键菜单
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\ai-tools" "" "使用 AI Tools 打开当前目录"
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\ai-tools" "Icon" "$INSTDIR\ai-tools.exe"
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\ai-tools\command" "" '"$INSTDIR\ai-tools.exe" "%V"'
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\Directory\shell\ai-tools"
  DeleteRegKey SHCTX "Software\Classes\Directory\Background\shell\ai-tools"
!macroend
