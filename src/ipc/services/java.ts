import { ServiceData } from "@/types/index";
import { invokeCommand } from '@/lib/tauri-api'
import { ipcLogFunc } from '../../utils/logger'
import { IPCResult } from "@/types/ipc";

export const ipcCheckJavaInstalled = ipcLogFunc('检查 Java 是否已安装', async (version: string): Promise<IPCResult<{ installed: boolean }>> => {
    return invokeCommand('check_java_installed', { version })
})

export const ipcCheckMavenInstalled = ipcLogFunc('检查 Maven 是否已安装', async (version: string): Promise<IPCResult<{ installed: boolean, home?: string }>> => {
    return invokeCommand('check_maven_installed', { version })
})

export const ipcGetJavaVersions = ipcLogFunc('获取 Java 版本列表', async (): Promise<IPCResult<{ 
    versions: Array<{
        version: string
        lts: boolean
        date: string
    }>
}>> => {
    return invokeCommand('get_java_versions')
})

export const ipcDownloadJava = ipcLogFunc('下载 Java', async (version: string, installMaven: boolean = false): Promise<IPCResult<{ task: any }>> => {
    return invokeCommand('download_java', { version, installMaven })
})

export const ipcCancelDownloadJava = ipcLogFunc('取消下载 Java', async (version: string): Promise<IPCResult<{ cancelled: boolean }>> => {
    return invokeCommand('cancel_download_java', { version })
})

export const ipcGetJavaDownloadProgress = ipcLogFunc('获取 Java 下载进度', async (version: string): Promise<IPCResult<{ task: any }>> => {
    return invokeCommand('get_java_download_progress', { version })
})

export const ipcInitializeMaven = ipcLogFunc('初始化 Maven', async (environmentId: string, serviceData: ServiceData): Promise<IPCResult<{ task: any }>> => {
    return invokeCommand('initialize_maven', { environmentId, serviceData })
})

export const ipcGetMavenDownloadProgress = ipcLogFunc('获取 Maven 下载进度', async (version: string): Promise<IPCResult<{ task: any }>> => {
    return invokeCommand('get_maven_download_progress', { version })
})

export const ipcGetJavaInfo = ipcLogFunc('获取 Java 信息', async (serviceData: ServiceData): Promise<IPCResult<{
    version: string
    vendor: string
    runtime: string
    vm: string
    home: string
}>> => {
    return invokeCommand('get_java_info', { serviceData })
})

export const ipcSetJavaHome = ipcLogFunc('设置 JAVA_HOME', async (environmentId: string, serviceData: ServiceData, javaHome: string): Promise<IPCResult> => {
    return invokeCommand('set_java_home', { environmentId, serviceData, javaHome })
})

export const ipcSetJavaOpts = ipcLogFunc('设置 JAVA_OPTS', async (environmentId: string, serviceData: ServiceData, javaOpts: string): Promise<IPCResult> => {
    return invokeCommand('set_java_opts', { environmentId, serviceData, javaOpts })
})

export const ipcSetMavenHome = ipcLogFunc('设置 MAVEN_HOME', async (environmentId: string, serviceData: ServiceData, mavenHome: string): Promise<IPCResult> => {
    return invokeCommand('set_maven_home', { environmentId, serviceData, mavenHome })
})

export const ipcSetGradleHome = ipcLogFunc('设置 GRADLE_HOME', async (environmentId: string, serviceData: ServiceData, gradleHome: string): Promise<IPCResult> => {
    return invokeCommand('set_gradle_home', { environmentId, serviceData, gradleHome })
})
