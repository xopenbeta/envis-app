import { ServiceData } from "@/types/index";
import { 
    ipcGetMongoConfig,
    ipcOpenMongoDBCompass,
    ipcOpenMongoDBShell,
    ipcInitializeMongoDB,
    ipcCheckMongoDBInitialized,
    ipcListenMongoDBInitProgress,
    ipcListMongoDBDatabases,
    ipcListMongoDBCollections,
    ipcCreateMongoDBDatabase,
    ipcCreateMongoDBUser,
    ipcListMongoDBUsers,
    ipcUpdateMongoDBUserRoles,
    ipcDeleteMongoDBUser,
} from "../../ipc/services/mongodb";
import { MongoDBConfig } from "@/types/service";
import { parseMongoDBYamlConfig } from "@/utils/mongodb-config-parser";
import { useEffect, useRef } from "react";
import { UnlistenFn } from "@tauri-apps/api/event";

/**
 * 获取 MongoDB 配置信息
 */
export async function getMongodbConfig(environmentId: string, serviceData: ServiceData) {
    const result = await ipcGetMongoConfig(environmentId, serviceData);
    console.log('zws MongoDB 配置结果:', result);
    // 如果成功且有内容,解析 YAML 配置并返回完整结果
    if (result.success && result.data?.content) {
        return parseMongoDBYamlConfig(result.data.content);
    }
    
    return null;
}

/**
 * 打开 MongoDB Compass
 */
export async function openMongoDBCompass(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcOpenMongoDBCompass(environmentId, serviceData);
}

/**
 * 打开 Mongo Shell
 */
export async function openMongoDBShell(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcOpenMongoDBShell(environmentId, serviceData);
}

/**
 * 初始化 MongoDB
 */
export async function initializeMongoDB(
    environmentId: string,
    serviceData: ServiceData,
    adminUsername: string,
    adminPassword: string,
    port?: string,
    bindIp?: string,
    enableReplicaSet?: boolean,
    reset?: boolean
) {
    return ipcInitializeMongoDB(environmentId, serviceData, adminUsername, adminPassword, port, bindIp, enableReplicaSet, reset);
}

/**
 * 检查 MongoDB 是否已初始化
 */
export async function checkMongoDBInitialized(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcCheckMongoDBInitialized(environmentId, serviceData);
}

/**
 * 列出所有数据库
 */
export async function listMongoDBDatabases(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcListMongoDBDatabases(environmentId, serviceData);
}

/**
 * 列出指定数据库的所有集合
 */
export async function listMongoDBCollections(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcListMongoDBCollections(environmentId, serviceData, databaseName);
}

/**
 * 创建数据库
 */
export async function createMongoDBDatabase(
    environmentId: string,
    serviceData: ServiceData,
    databaseName: string
) {
    return ipcCreateMongoDBDatabase(environmentId, serviceData, databaseName);
}

/**
 * 创建普通用户
 */
export async function createMongoDBUser(
    environmentId: string,
    serviceData: ServiceData,
    username: string,
    password: string,
    databases: string[],
    roles: string[]
) {
    return ipcCreateMongoDBUser(environmentId, serviceData, username, password, databases, roles);
}

/**
 * 列出所有用户
 */
export async function listMongoDBUsers(
    environmentId: string,
    serviceData: ServiceData
) {
    return ipcListMongoDBUsers(environmentId, serviceData);
}

/**
 * 更新用户权限
 */
export async function updateMongoDBUserRoles(
    environmentId: string,
    serviceData: ServiceData,
    username: string,
    databases: string[],
    roles: string[]
) {
    return ipcUpdateMongoDBUserRoles(environmentId, serviceData, username, databases, roles);
}

/**
 * 删除用户
 */
export async function deleteMongoDBUser(
    environmentId: string,
    serviceData: ServiceData,
    username: string
) {
    return ipcDeleteMongoDBUser(environmentId, serviceData, username);
}

/**
 * 监听 MongoDB 初始化进度
 */
export function useMongoDBInitProgress(
    callback: (payload: { step: string; message: string }) => void
) {
    const unlistenRef = useRef<UnlistenFn | null>(null);

    useEffect(() => {
        const setupListener = async () => {
            unlistenRef.current = await ipcListenMongoDBInitProgress(callback);
        };

        setupListener();

        return () => {
            if (unlistenRef.current) {
                unlistenRef.current();
            }
        };
    }, [callback]);
}

/**
 * MongoDB Hook
 * 提供 MongoDB 相关的操作方法
 */
export function useMongodb() {
    return {
        getMongodbConfig,
        openMongoDBCompass,
        openMongoDBShell,
        initializeMongoDB,
        checkMongoDBInitialized,
        listMongoDBDatabases,
        listMongoDBCollections,
        createMongoDBDatabase,
        createMongoDBUser,
        listMongoDBUsers,
        updateMongoDBUserRoles,
        deleteMongoDBUser,
        useMongoDBInitProgress,
    };
}
