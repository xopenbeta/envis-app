import { ipcOpenFolderInFinder, ipcSelectFolder } from "../ipc/file-operations";

export function useFileOperations() {
  function openFolderInFinder(folderPath: string) {
    ipcOpenFolderInFinder(folderPath)
  }

  async function selectFolder(options?: { title?: string, defaultPath?: string }) {
    return ipcSelectFolder(options || {})
  }

  return {
    openFolderInFinder,
    selectFolder
  }
}
