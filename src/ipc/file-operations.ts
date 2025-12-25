import { IPCResult } from "@/types/ipc"
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../utils/logger'

export const ipcOpenSelectDialog = ipcLogFunc('打开文件选择对话框', async (): Promise<IPCResult> => {
    return invokeCommand('open_file_dialog');
})

export const ipcReadFileContent = ipcLogFunc('读取文件内容', async (filePath: string): Promise<IPCResult> => {
    return invokeCommand('read_file_content', { filePath });
})

export const ipcIsFileWrite = ipcLogFunc('检查文件是否可写', async (filePath: string): Promise<IPCResult> => {
    return invokeCommand('is_file_write', { filePath });
})

export const ipcSelectFolder = ipcLogFunc('选择文件夹', async (options: { title?: string, defaultPath?: string }): Promise<IPCResult> => {
    return invokeCommand('open_folder_dialog', options);
})

export const ipcOpenFolderInFinder = ipcLogFunc('在文件管理器中打开', async (folderPath: string): Promise<IPCResult> => {
    return invokeCommand('open_in_file_manager', { path: folderPath });
})
