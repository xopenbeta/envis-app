import { Toaster } from "@/components/ui/sonner";
import { UpdateDialog } from '@/pages/update-dialog';
import { useInitEnvis } from '@/hooks';
import { isAppLoadingAtom } from "@/store/appSettings";
import { useAtom } from "jotai";
import Envis from "./pages";
import { useAppTheme } from "./hooks/useTheme";
import { Loading } from "./Loading";
import { useAppTitleVersion } from "./hooks/useAppVersion";
import { useRustLogger } from "./hooks/useRustLogger";

function App(): JSX.Element {
  const { isEnvisInited } = useInitEnvis();
  const [isAppLoading] = useAtom(isAppLoadingAtom);
  useAppTheme();
  useAppTitleVersion();
  useRustLogger(); // 附加 Rust 日志到浏览器控制台

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
