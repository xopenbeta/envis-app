import { useEffect, useState } from "react"
import { useAppSettings } from "./appSettings"
import { useEnvironmentServiceData } from "./env-serv-data";
import { useAtom } from "jotai";
import { isAppLoadingAtom } from "@/store/appSettings";
import { useLogger } from "./log";
import { Environment } from "@/types";

// 初始化整个Envis应用
export function useInitEnvis() {
    const { initAppSettings, initSystemSettings, appSettings, systemSettings } = useAppSettings();
    const { initEnvironments, deactivateAllEnvAndServDatas, autoStartEnvironment } = useEnvironmentServiceData();
    const [isEnvisInited, setisEnvisInited] = useState(false);
    const [, setIsAppLoading] = useAtom(isAppLoadingAtom)
    const { logInfo, logError } = useLogger();

    const refresh = async () => {
        let environments: Environment[] = [];
        // 初始化应用设置
        const appSettings = initAppSettings()
        // 初始化系统设置
        const systemSettings = await initSystemSettings()
        // 初始化环境数据
        if (appSettings && systemSettings) {
            environments = await initEnvironments();
        }
        return environments;
    }

    const initialize = async () => {
        setIsAppLoading(true);
        try {
            const environments = await refresh()

            // 现在有命令行了，实际上不必要了
            // // 首先尝试关闭所有环境
            // await deactivateAllEnvAndServDatas(environments)
            // console.log('【init】所有环境和服务已停用')
            // // 尝试自动启动上次使用的环境
            // if (appSettings && systemSettings) {
            //     await autoStartEnvironment(systemSettings, environments)
            // }
            // console.log('【init】自动启动上次使用的环境完成')

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
