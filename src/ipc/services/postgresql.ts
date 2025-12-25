import { ServiceData } from "@/types/index";
import { IPCResult } from "@/types/ipc";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'

export const ipcGetPostgresqlVersions = ipcLogFunc('获取 PostgreSQL 版本列表', async (): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_versions')
})

export const ipcDownloadPostgresql = ipcLogFunc('下载 PostgreSQL', async (version: string): Promise<IPCResult> => {
    return invokeCommand('download_postgresql', { version })
})

export const ipcCancelPostgresqlDownload = ipcLogFunc('取消 PostgreSQL 下载', async (version: string): Promise<IPCResult> => {
    return invokeCommand('cancel_postgresql_download', { version })
})

export const ipcCheckPostgresqlInstalled = ipcLogFunc('检查 PostgreSQL 是否已安装', async (version: string): Promise<IPCResult> => {
    return invokeCommand('check_postgresql_installed', { version })
})

export const ipcGetPostgresqlDownloadProgress = ipcLogFunc('获取 PostgreSQL 下载进度', async (version: string): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_download_progress', { version })
})

export const ipcStartPostgresqlService = ipcLogFunc('启动 PostgreSQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('start_postgresql_service', { environmentId, serviceData })
})

export const ipcStopPostgresqlService = ipcLogFunc('停止 PostgreSQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('stop_postgresql_service', { environmentId, serviceData })
})

export const ipcRestartPostgresqlService = ipcLogFunc('重启 PostgreSQL 服务', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('restart_postgresql_service', { environmentId, serviceData })
})

export const ipcGetPostgresqlConfig = ipcLogFunc('获取 PostgreSQL 配置', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_config', { environmentId, serviceData })
})

export const ipcSetPostgresqlDataPath = ipcLogFunc('设置 PostgreSQL 数据目录', async (environmentId: string, serviceData: ServiceData, dataPath: string): Promise<IPCResult> => {
    return invokeCommand('set_postgresql_data_path', { environmentId, serviceData, dataPath })
})

export const ipcSetPostgresqlPort = ipcLogFunc('设置 PostgreSQL 端口', async (environmentId: string, serviceData: ServiceData, port: number): Promise<IPCResult> => {
    return invokeCommand('set_postgresql_port', { environmentId, serviceData, port })
})

export const ipcGetPostgresqlServiceStatus = ipcLogFunc('获取 PostgreSQL 服务状态', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult> => {
    return invokeCommand('get_postgresql_service_status', { environmentId, serviceData })
})
