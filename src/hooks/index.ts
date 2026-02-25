import { useEffect, useState } from "react"
import { useAppSettings } from "./appSettings"
import { useEnvironmentServiceData } from "./env-serv-data";
import { useAtom } from "jotai";
import { isAppLoadingAtom } from "@/store/appSettings";
import { useLogger } from "./log";
import { Environment } from "@/types";

// 初始化整个Envis应用
export function useInitEnvis() {
    const { initAppSettings, initSystemSettings } = useAppSettings();
    const { initEnvironments, deactivateAllEnvAndServDatas, autoStartEnvironment } = useEnvironmentServiceData();
    const [isEnvisInited, setisEnvisInited] = useState(false);
    const [, setIsAppLoading] = useAtom(isAppLoadingAtom)
    const { logInfo, logError } = useLogger();

    const refresh = async () => {
        let environments: Environment[] = [];
        let systemSettings = null;
        // 初始化应用设置
        const appSettings = initAppSettings()
        // 初始化系统设置
        systemSettings = await initSystemSettings()
        // 初始化环境数据
        environments = await initEnvironments();
        return { environments, systemSettings };
    }

    const initialize = async () => {
        setIsAppLoading(true);
        try {
            const { environments, systemSettings } = await refresh()

            const lastUsedEnvironmentIds = systemSettings?.lastUsedEnvironmentIds?.filter(Boolean) ?? []
            console.debug('【init-debug】记录的上次环境IDs:', lastUsedEnvironmentIds)
            logInfo(`【init-debug】记录的上次环境IDs: ${JSON.stringify(lastUsedEnvironmentIds)}`)

            if (systemSettings?.autoActivateLastUsedEnvironmentOnAppStart) {
                await autoStartEnvironment(systemSettings, environments)
                console.log('【init】自动启动上次使用的环境完成')
            }

            setisEnvisInited(true)
            logInfo('【init】Envis 应用初始化完成')
        } catch (e: any) {
            logError(`【init】启动失败: ${e?.message || String(e)}`)
        }
        setisEnvisInited(true)
        setIsAppLoading(false);
    }

    useEffect(() => {
        initialize()
    }, [])

    useEffect(() => {
        const handleFocus = () => {
            if (isEnvisInited) {
                refresh();
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [isEnvisInited]);

    return { isEnvisInited };
}
