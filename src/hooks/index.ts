import { useEffect, useState } from "react"
import { useAppSettings } from "./appSettings"
import { useEnvironmentServiceData } from "./env-serv-data";
import { useAtom } from "jotai";
import { isAppLoadingAtom } from "@/store/appSettings";
import { useLogger } from "./log";

// 初始化整个Envis应用
export function useInitEnvis() {
    const { initAppSettings, initSystemSettings, appSettings, systemSettings } = useAppSettings();
    const { initEnvironments } = useEnvironmentServiceData();
    const [isEnvisInited, setisEnvisInited] = useState(false);
    const [, setIsAppLoading] = useAtom(isAppLoadingAtom)
    const { logInfo, logError } = useLogger();

    useEffect(() => {
        const initialize = async () => {
            setIsAppLoading(true);
            try {
                // 初始化应用设置
                const appSettings = initAppSettings()
                // 初始化系统设置
                const systemSettings = await initSystemSettings()
                // 初始化环境数据
                if (appSettings && systemSettings) {
                    await initEnvironments(appSettings, systemSettings)
                }
                setisEnvisInited(true)
                logInfo('【init】Envis 应用初始化完成')
            } catch (e: any) {
                logError(`【init】启动失败: ${e?.message || String(e)}`)
            }
            setIsAppLoading(false);
        }

        initialize()
    }, [])

    return { isEnvisInited };
}
