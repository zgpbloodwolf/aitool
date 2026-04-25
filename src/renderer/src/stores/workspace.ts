import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  children?: FileEntry[]
}

export interface Project {
  id: string
  path: string
  name: string
  isFavorite: boolean
  tags: string[]
  isActive: boolean
  files: FileEntry[]
  expandedDirs: Set<string>
  expanded: boolean // 侧边栏中是否展开文件树
}

function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function pathBasename(p: string): string {
  return p.split(/[\\/]/).pop() || p
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const projects = ref<Project[]>([])
  const activeProjectId = ref<string | null>(null)
  const filterText = ref('')

  // 每个项目的 watcher 取消函数
  const projectWatchers = new Map<string, () => void>()

  // Computed
  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value) ?? null
  )

  const activePath = computed(() => activeProject.value?.path ?? null)

  const favoriteProjects = computed(() =>
    projects.value.filter(p => p.isFavorite)
  )

  const ephemeralProjects = computed(() =>
    projects.value.filter(p => !p.isFavorite)
  )

  // 收藏项目按标签分组
  const favoritesByTag = computed(() => {
    const groups: Record<string, Project[]> = {}
    for (const p of favoriteProjects.value) {
      if (p.tags.length === 0) {
        ;(groups['未分组'] ??= []).push(p)
      } else {
        for (const tag of p.tags) {
          ;(groups[tag] ??= []).push(p)
        }
      }
    }
    return groups
  })

  // 获取所有唯一标签
  const allTags = computed(() => {
    const tags = new Set<string>()
    for (const p of favoriteProjects.value) {
      for (const t of p.tags) tags.add(t)
    }
    return [...tags]
  })

  // 指定项目的过滤文件列表
  function filteredProjectFiles(projectId: string): FileEntry[] {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return []
    if (!filterText.value.trim()) return project.files
    return filterFiles(project.files, filterText.value.trim().toLowerCase())
  }

  // 目录加载
  async function loadDirectory(dirPath: string, expandedDirs: Set<string>): Promise<FileEntry[]> {
    const entries = await window.api.readDir(dirPath)
    const result: FileEntry[] = []
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      const item: FileEntry = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile
      }
      if (entry.isDirectory && expandedDirs.has(fullPath)) {
        item.children = await loadDirectory(fullPath, expandedDirs)
      }
      result.push(item)
    }
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return result
  }

  // 添加项目
  async function addProject(dirPath?: string): Promise<Project | null> {
    const path = dirPath ?? (await window.api.selectFolder())
    if (!path) return null

    // 已存在则激活
    const existing = projects.value.find(p => p.path === path)
    if (existing) {
      activateProject(existing.id)
      return existing
    }

    const id = generateProjectId()
    const project: Project = {
      id,
      path,
      name: pathBasename(path),
      isFavorite: false,
      tags: [],
      isActive: true,
      files: [],
      expandedDirs: new Set(),
      expanded: true
    }

    // 取消之前的 active
    for (const p of projects.value) p.isActive = false
    activeProjectId.value = id

    await window.api.claudeSetCwd(path)
    project.files = await loadDirectory(path, project.expandedDirs)
    await startProjectWatch(project)

    projects.value.push(project)
    return project
  }

  // 移除项目
  function removeProject(projectId: string): void {
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx === -1) return
    stopProjectWatch(projectId)
    projects.value.splice(idx, 1)

    // 如果移除的是 active，激活第一个
    if (activeProjectId.value === projectId) {
      const next = projects.value[0]
      if (next) {
        activateProject(next.id)
      } else {
        activeProjectId.value = null
      }
    }
    persistProjects()
  }

  // 激活项目
  async function activateProject(projectId: string): Promise<void> {
    for (const p of projects.value) p.isActive = false
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.isActive = true
    activeProjectId.value = projectId
    await window.api.claudeSetCwd(project.path)
  }

  // 切换项目目录展开
  async function toggleProjectDir(projectId: string, dirPath: string): Promise<void> {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    if (project.expandedDirs.has(dirPath)) {
      project.expandedDirs.delete(dirPath)
    } else {
      project.expandedDirs.add(dirPath)
    }
    await updateNodeChildren(project.files, dirPath, project.expandedDirs)
  }

  async function updateNodeChildren(
    nodes: FileEntry[],
    targetPath: string,
    expandedDirs: Set<string>
  ): Promise<boolean> {
    for (const node of nodes) {
      if (node.path === targetPath && node.isDirectory) {
        node.children = await loadDirectory(targetPath, expandedDirs)
        return true
      }
      if (node.children) {
        const found = await updateNodeChildren(node.children, targetPath, expandedDirs)
        if (found) return true
      }
    }
    return false
  }

  // 选中文件
  const selectedFile = ref<string | null>(null)
  function selectFile(path: string): void {
    selectedFile.value = path
  }

  // 展开/折叠项目文件树（侧边栏层面）
  async function toggleProjectExpanded(projectId: string): Promise<void> {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.expanded = !project.expanded
    if (project.expanded && project.files.length === 0) {
      project.files = await loadDirectory(project.path, project.expandedDirs)
      await startProjectWatch(project)
    }
    if (!project.expanded) {
      stopProjectWatch(project.id)
    }
  }

  // 文件监听
  async function startProjectWatch(project: Project): Promise<void> {
    stopProjectWatch(project.id)
    await window.api.startFileWatch(project.id, project.path)
    const off = window.api.onFileChanged(project.id, async () => {
      project.files = await loadDirectory(project.path, project.expandedDirs)
    })
    projectWatchers.set(project.id, off)
  }

  function stopProjectWatch(projectId: string): void {
    const off = projectWatchers.get(projectId)
    if (off) { off(); projectWatchers.delete(projectId) }
    window.api.stopFileWatch(projectId)
  }

  // 搜索过滤
  function filterFiles(entries: FileEntry[], query: string): FileEntry[] {
    const result: FileEntry[] = []
    for (const entry of entries) {
      if (entry.isDirectory) {
        const filteredChildren = entry.children ? filterFiles(entry.children, query) : []
        if (filteredChildren.length > 0 || entry.name.toLowerCase().includes(query)) {
          result.push({
            ...entry,
            children:
              filteredChildren.length > 0
                ? filteredChildren
                : entry.children
                  ? entry.children.filter((c) => c.name.toLowerCase().includes(query))
                  : undefined
          })
        }
      } else {
        if (entry.name.toLowerCase().includes(query)) {
          result.push(entry)
        }
      }
    }
    return result
  }

  // 收藏操作
  function toggleFavorite(projectId: string): void {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.isFavorite = !project.isFavorite
    persistProjects()
  }

  // 标签操作
  function addTag(projectId: string, tag: string): void {
    const project = projects.value.find(p => p.id === projectId)
    if (!project || project.tags.includes(tag)) return
    project.tags.push(tag)
    persistProjects()
  }

  function removeTag(projectId: string, tag: string): void {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.tags = project.tags.filter(t => t !== tag)
    persistProjects()
  }

  // 持久化：只保存收藏项目
  function persistProjects(): void {
    const toSave = projects.value
      .filter(p => p.isFavorite)
      .map(p => ({ path: p.path, name: p.name, tags: p.tags }))
    localStorage.setItem('aitools-projects', JSON.stringify(toSave))
  }

  // 启动时恢复收藏项目（不加载文件/不启动 watcher）
  function loadPersistedProjects(): void {
    migrateOldFavorites()
    const raw = localStorage.getItem('aitools-projects')
    if (!raw) return
    try {
      const saved: Array<{ path: string; name: string; tags: string[] }> = JSON.parse(raw)
      for (const entry of saved) {
        projects.value.push({
          id: generateProjectId(),
          path: entry.path,
          name: entry.name || pathBasename(entry.path),
          isFavorite: true,
          tags: entry.tags || [],
          isActive: false,
          files: [],
          expandedDirs: new Set(),
          expanded: false
        })
      }
    } catch { /* 解析失败不影响启动 */ }
  }

  // 迁移旧 favorites 格式
  function migrateOldFavorites(): void {
    const oldFavs = localStorage.getItem('aitools-favorites')
    if (!oldFavs) return
    try {
      const paths: string[] = JSON.parse(oldFavs)
      // 合并到新格式
      const existing = new Set(
        (JSON.parse(localStorage.getItem('aitools-projects') || '[]') as Array<{ path: string }>)
          .map(e => e.path)
      )
      const current: Array<{ path: string; name: string; tags: string[] }> =
        JSON.parse(localStorage.getItem('aitools-projects') || '[]')
      for (const path of paths) {
        if (!existing.has(path)) {
          current.push({ path, name: pathBasename(path), tags: [] })
        }
      }
      localStorage.setItem('aitools-projects', JSON.stringify(current))
      localStorage.removeItem('aitools-favorites')
    } catch { /* 迁移失败不影响启动 */ }
  }

  return {
    projects,
    activeProjectId,
    filterText,
    selectedFile,
    activeProject,
    activePath,
    favoriteProjects,
    ephemeralProjects,
    favoritesByTag,
    allTags,
    filteredProjectFiles,
    addProject,
    removeProject,
    activateProject,
    toggleProjectDir,
    toggleProjectExpanded,
    selectFile,
    toggleFavorite,
    addTag,
    removeTag,
    loadPersistedProjects,
    filterFiles
  }
})
