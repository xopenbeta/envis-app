import { Toaster } from "@/components/ui/sonner";
import { UpdateDialog } from '@/pages/update-dialog';
import { useInitEnvis } from '@/hooks';
import { useEnvironmentServiceData } from '@/hooks/env-serv-data';
import { isAppLoadingAtom } from "@/store/app";
import { useAtom } from "jotai";
import Envis from "./pages";
import { useAppTheme } from "./hooks/useTheme";
import { Loading } from "./Loading";
import { useAppTitleVersion } from "./hooks/useAppVersion";
import { useRustLogger } from "./hooks/useRustLogger";
import { useEffect } from "react";
import { useI18n } from "./hooks/useI18n";

function App(): JSX.Element {
  useRustLogger(); // 附加 Rust 日志到浏览器控制台
  const { isEnvisInited } = useInitEnvis();
  const [isAppLoading] = useAtom(isAppLoadingAtom);
  useI18n();
  useAppTheme();
  useAppTitleVersion();

  return (
    <>
      {isEnvisInited && <Envis />}
      {isAppLoading && <Loading />}
      <UpdateDialog />
      <Toaster
        position="bottom-center"
        toastOptions={{
          className: 'heroui-card heroui-transition',
          style: {
            background: 'hsl(var(--content1))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--divider) / 0.6)',
            borderRadius: 'calc(var(--radius) * 1.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }
        }}
      />
    </>
  )
}

export default App
