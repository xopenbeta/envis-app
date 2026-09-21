import { useAtom } from "jotai";
import { updateAvailableAtom, isUpdateDialogOpenAtom } from '@/store/app';
import pkg from '../../../package.json';
import { Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';

export function AppFooter(props: {
    isShowConsoleBtn?: boolean,
    onConsoleBtnClick?: () => void
}) {
    const { t } = useTranslation()
    const [updateAvailable] = useAtom(updateAvailableAtom)
    const [, setIsUpdateDialogOpen] = useAtom(isUpdateDialogOpenAtom)

    return (
        <div className="border-t border-divider bg-content1 dark:bg-background px-4 h-[32px] flex justify-between items-center text-[10px] text-muted-foreground dark:text-muted-foreground select-none">
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0 rounded-full bg-danger text-primary-foreground hover:bg-danger dark:bg-danger dark:hover:bg-danger transition-colors font-medium"
                    >
                    {t('app_footer.update_available')}
                    </button>
                )}
            </div>
        </div>
    )
}
