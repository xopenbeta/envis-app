import { useAtom } from "jotai";
import { updateAvailableAtom, isUpdateDialogOpenAtom } from '@/store/appSettings';
import pkg from '../../package.json';
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppFooter(props: {
    isShowConsoleBtn?: boolean,
    onConsoleBtnClick?: () => void
}) {
    const [updateAvailable] = useAtom(updateAvailableAtom)
    const [, setIsUpdateDialogOpen] = useAtom(isUpdateDialogOpenAtom)

    return (
        <div className="border-t border-gray-200 dark:border-white/5 bg-white dark:bg-[#030303] px-4 h-[32px] flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-600 select-none">
            <div className="flex items-center gap-3">
                {props.isShowConsoleBtn && (
                    <Button
                        variant="ghost"
                        className="h-4 w-4 text-[10px]"
                        onClick={props.onConsoleBtnClick}
                    >
                        <Terminal className="h-3 w-3" />
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-4">
                <span>{`v${pkg.version}`}</span>
                {updateAvailable && (
                    <button
                        onClick={() => setIsUpdateDialogOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0 rounded-full bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 transition-colors font-medium"
                    >
                        Update Available
                    </button>
                )}
            </div>
        </div>
    )
}
