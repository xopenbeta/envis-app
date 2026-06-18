import { ServiceData } from "@/types/index";
import {
    ipcGetRedisConfig,
    ipcInitializeRedis,
    ipcCheckRedisInitialized,
    ipcOpenRedisClient,
} from "../../ipc/services/redis";

export async function getRedisConfig(environmentId: string, serviceData: ServiceData) {
    return ipcGetRedisConfig(environmentId, serviceData)
}

export async function initializeRedis(
    environmentId: string,
    serviceData: ServiceData,
    password?: string,
    port?: string,
    bindIp?: string,
    rdbEnabled?: boolean,
    aofEnabled?: boolean,
    reset?: boolean,
) {
    return ipcInitializeRedis(environmentId, serviceData, password, port, bindIp, rdbEnabled, aofEnabled, reset)
}

export async function checkRedisInitialized(environmentId: string, serviceData: ServiceData) {
    return ipcCheckRedisInitialized(environmentId, serviceData)
}

export async function openRedisClient(environmentId: string, serviceData: ServiceData) {
    return ipcOpenRedisClient(environmentId, serviceData)
}

export function useRedis() {
    return {
        getRedisConfig,
        initializeRedis,
        checkRedisInitialized,
        openRedisClient,
    }
}
