import { Button } from "@/components/ui/button";
import { isAIPanelOpenAtom } from "@/store";
import { useAtom } from "jotai";
import { useState, useEffect } from "react";
import { Github, Server, Code, Database, Settings, PanelLeft, Bot, Zap, Globe, Box, Layers, Terminal, Command, Cpu, Plus, FolderOpen, Book, Clock, ArrowRight, Search, GripVertical, Play, Square, Hexagon, Info, MemoryStick, HardDrive, Wifi, Users, MessageCircle, MessageSquare, AlertTriangle, X } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { openExternal } from '@/lib/tauri-api'
import { environmentsAtom } from '@/store/environment'
import { useEnvironment } from '@/hooks/environment'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { useSystemInfo } from '@/hooks/system-info'
import { Environment, EnvironmentStatus } from '@/types/index'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "@/components/ui/pie-chart";
import { Progress } from "@/components/ui/progress";
import { SystemMonitor, useSystemMonitorData } from '@/pages/system-monitor';
import { AppFooter } from "@/pages/app-footer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from 'react-i18next';
import { isCreateEnvDialogOpenAtom } from '@/store/environment';

export function WelcomeFragment({ onOpen }: {
    onOpen?: () => void;
}) {
    const { t } = useTranslation();
    const [, setIsCreateEnvDialogOpen] = useAtom(isCreateEnvDialogOpenAtom);
    const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
    const { openTerminal } = useSystemInfo()
    const systemInfo = useSystemMonitorData()
    const [showContactDialog, setShowContactDialog] = useState(false);
    const [networkError, setNetworkError] = useState(false);

    useEffect(() => {
        let isActive = true;
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            if (!isActive) return;
            setNetworkError(true);
            controller.abort();
        }, 5000);

        fetch("https://www.google.com/generate_204", {
            method: "GET",
            mode: "no-cors",
            signal: controller.signal,
        })
            .then(() => {
                if (!isActive) return;
                setNetworkError(false);
            })
            .catch((error: unknown) => {
                if (!isActive) return;
                if (error instanceof Error && error.name === "AbortError") return;
                setNetworkError(true);
            })
            .finally(() => {
                window.clearTimeout(timeoutId);
            });

        return () => {
            isActive = false;
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, []);

    return (
        <div className="relative w-full h-full bg-content1 dark:bg-background text-foreground dark:text-primary-foreground overflow-hidden flex flex-col font-sans selection:bg-focus/20 dark:selection:bg-content1/20">
            {/* Cursor-style Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* Subtle gradient glow at the top */}
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-overlay/[0.02] dark:bg-content1/25 blur-[120px] rounded-full"></div>

                {/* Grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--default)/0.07)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--default)/0.07)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--overlay))_70%,transparent_100%)]"></div>
            </div>

            {/* Floating Buttons */}
            {onOpen && (
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation()
                        onOpen()
                    }}
                    className="absolute top-1.5 left-2 z-50 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-content2 transition-all h-8 w-8"
                >
                    <PanelLeft className="h-4 w-4" />
                </Button>
            )}
            <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                    e.stopPropagation()
                    setIsAIPanelOpen(isAIPanelOpen => !isAIPanelOpen)
                }}
                className="absolute top-1.5 right-2 z-50 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-content2 transition-all h-8 w-8"
            >
                <Bot className="h-4 w-4" />
            </Button>

            {/* Main Content - App Welcome Screen */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
                <div className="w-full max-w-2xl px-6 flex flex-col gap-8">

                    {/* Brand Header */}
                    <div className="text-center space-y-4 mt-12">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-primary-foreground mb-2">Envis</h1>
                            <p className="text-muted-foreground dark:text-muted-foreground text-sm">{t('welcome.subtitle')}</p>
                        </div>
                        <div className="w-full flex justify-center">
                            <a
                                href="https://discord.gg/dqS55wdvd"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center z-50 h-7 px-2.5 rounded-full mr-2 border border-focus/30 bg-focus/10 text-focus text-xs font-medium hover:bg-focus/15 transition-colors dark:border-focus/30 dark:bg-focus/10 dark:text-focus dark:hover:bg-focus/20"
                            >
                                {t('welcome.discord_community')}
                            </a>
                            <a
                                href="https://github.com/xopenbeta/envis-app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success border border-success/30 hover:bg-success/15 transition-colors dark:bg-success/10 dark:text-success dark:border-success/20 dark:hover:bg-success/20"
                            >
                                <Github className="w-4 h-4" />
                                <span className="text-xs">{t('welcome.github_star')}</span>
                                <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                            </a>
                        </div>
                    </div>

                    {/* 网络不畅通提示 */}
                    {networkError && (
                        <div className="w-full max-w-2xl mx-auto mt-6">
                            <div className="flex items-center gap-2 p-3 rounded-lg border border-danger/30 bg-danger/10 dark:border-danger/30 dark:bg-danger/10">
                                <AlertTriangle className="w-4 h-4 text-danger dark:text-danger" />
                                <div className="flex-1 text-xs text-danger dark:text-danger">
                                    {t('welcome.network_error')}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CMD Warning (Windows only) */}
                    <CmdWarningBanner />

                    {/* Windows Defender Warning (Windows only) */}
                    <DefenderWarningBanner />

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ActionCard
                            icon={<Plus className="w-5 h-5 text-focus dark:text-focus" />}
                            title={t('welcome.new_environment')}
                            desc={t('welcome.new_environment_desc')}
                            onClick={() => {
                                onOpen?.();
                                setIsCreateEnvDialogOpen(true);
                            }}
                        />
                        <ActionCard
                            icon={<Terminal className="w-5 h-5 text-warning dark:text-warning" />}
                            title={t('welcome.open_terminal')}
                            desc={t('welcome.open_terminal_desc')}
                            onClick={() => openTerminal()}
                        />
                        <ActionCard
                            icon={<Zap className="w-5 h-5 text-focus dark:text-focus" />}
                            title={t('welcome.ai_assistant')}
                            desc={t('welcome.ai_assistant_desc')}
                            onClick={() => setIsAIPanelOpen(true)}
                        />
                        <ActionCard
                            icon={<Book className="w-5 h-5 text-success dark:text-success" />}
                            title={t('welcome.documentation')}
                            desc={t('welcome.documentation_desc')}
                            onClick={() => openExternal('https://envis.app/docs/')}
                        />
                    </div>

                    {/* Usage Scenarios */}
                    <div className="space-y-3">
                        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">{t('welcome.use_cases')}</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                {
                                    icon: <Zap className="w-5 h-5 text-warning dark:text-warning" />,
                                    title: t('welcome.rapid_setup'),
                                    description: t('welcome.rapid_setup_desc')
                                },
                                {
                                    icon: <Layers className="w-5 h-5 text-focus dark:text-focus" />,
                                    title: t('welcome.multi_project'),
                                    description: t('welcome.multi_project_desc')
                                },
                                {
                                    icon: <Users className="w-5 h-5 text-success dark:text-success" />,
                                    title: t('welcome.team_standardization'),
                                    description: t('welcome.team_standardization_desc')
                                }
                            ].map((scenario, index) => (
                                <div key={index} className="flex items-start gap-4 p-4 rounded-xl border border-divider bg-content1 hover:bg-content2 hover:border-default transition-all group">
                                    <div className="mt-1 p-2 rounded-lg bg-content1 dark:bg-content1/40 border border-divider group-hover:border-default dark:group-hover:border-white/10 transition-colors shrink-0">
                                        {scenario.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-foreground dark:text-primary-foreground mb-1.5 group-hover:text-focus dark:group-hover:text-focus transition-colors">{scenario.title}</h3>
                                        <p className="text-xs text-muted-foreground dark:text-muted-foreground leading-relaxed">{scenario.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Getting Started */}
                    <div className="space-y-3">
                        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">{t('welcome.getting_started')}</h2>
                        <div className="grid grid-cols-3 gap-3">
                            <Step number="1" title={t('welcome.step_1_title')} desc={t('welcome.step_1_desc')} />
                            <Step number="2" title={t('welcome.step_2_title')} desc={t('welcome.step_2_desc')} />
                            <Step number="3" title={t('welcome.step_3_title')} desc={t('welcome.step_3_desc')} />
                        </div>
                    </div>

                    {/* System Monitor */}
                    <SystemMonitor systemInfo={systemInfo} />

                    {/* Feedback & Suggestions */}
                    <div className="space-y-3 mb-6">
                        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">{t('welcome.feedback')}</h2>
                        <div className="flex flex-col rounded-lg border border-divider bg-content1 overflow-hidden">
                            <a
                                href="https://github.com/xopenbeta/envis-app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 hover:bg-content2 transition-colors cursor-pointer border-b border-divider last:border-0"
                            >
                                <div className="w-8 h-8 rounded-full bg-content3 dark:bg-content2 flex items-center justify-center text-foreground dark:text-primary-foreground">
                                    <Github className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-foreground dark:text-primary-foreground">{t('welcome.github')}</div>
                                    <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('welcome.feedback_desc')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </a>

                            <a
                                href="https://discord.gg/dqS55wdvd"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 hover:bg-content2 transition-colors cursor-pointer border-b border-divider last:border-0"
                            >
                                <div className="w-8 h-8 rounded-full bg-focus/15 dark:bg-focus/20 flex items-center justify-center text-focus dark:text-focus">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-foreground dark:text-primary-foreground">{t('welcome.discord')}</div>
                                    <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('welcome.join_discord')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </a>

                            <div
                                onClick={() => setShowContactDialog(true)}
                                className="flex items-center gap-3 p-3 hover:bg-content2 transition-colors cursor-pointer border-b border-divider last:border-0"
                            >
                                <div className="w-8 h-8 rounded-full bg-focus/15 dark:bg-focus/20 flex items-center justify-center text-focus dark:text-focus">
                                    <MessageCircle className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-foreground dark:text-primary-foreground">QQ</div>
                                    <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('welcome.join_qq')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </div>

                            <div
                                onClick={() => setShowContactDialog(true)}
                                className="flex items-center gap-3 p-3 hover:bg-content2 transition-colors cursor-pointer"
                            >
                                <div className="w-8 h-8 rounded-full bg-success/15 dark:bg-success/20 flex items-center justify-center text-success dark:text-success">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-foreground dark:text-primary-foreground">{t('welcome.wechat')}</div>
                                    <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{t('welcome.join_wechat')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Status Bar */}
            <AppFooter />

            <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('welcome.join_community')}</DialogTitle>
                        <DialogDescription>
                            {t('welcome.join_community_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <a
                            href="https://discord.gg/dqS55wdvd"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 rounded-lg border border-divider bg-content1 hover:bg-content2 transition-colors"
                        >
                            <div className="p-2 bg-focus/15 dark:bg-focus/20 text-focus dark:text-focus rounded-lg">
                                <Globe className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-medium text-foreground dark:text-primary-foreground">{t('welcome.discord')}</div>
                                <div className="text-sm text-muted-foreground dark:text-muted-foreground">{t('welcome.join_discord')}</div>
                            </div>
                        </a>
                        <div className="flex items-center gap-4 p-4 rounded-lg border border-divider bg-content1">
                            <div className="p-2 bg-focus/15 dark:bg-focus/20 text-focus dark:text-focus rounded-lg">
                                <MessageCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-medium text-foreground dark:text-primary-foreground">{t('welcome.qq_group')}</div>
                                <div className="text-sm text-muted-foreground dark:text-muted-foreground">{t('welcome.qq_group_id', { id: '1036572489' })}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-lg border border-divider bg-content1">
                            <div className="p-2 bg-success/15 dark:bg-success/20 text-success dark:text-success rounded-lg">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-medium text-foreground dark:text-primary-foreground">{t('welcome.wechat_group')}</div>
                                <div className="text-sm text-muted-foreground dark:text-muted-foreground">{t('welcome.wechat_group_desc')}</div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ActionCard({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-start gap-4 p-4 rounded-xl border border-divider bg-content1 hover:bg-content2 hover:border-default transition-all text-left group"
        >
            <div className="mt-1 p-2 rounded-lg bg-content1 dark:bg-content1/40 border border-divider group-hover:border-default dark:group-hover:border-white/10 transition-colors">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-medium text-foreground dark:text-primary-foreground mb-1 group-hover:text-focus dark:group-hover:text-focus transition-colors">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </button>
    )
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
    return (
        <div className="flex flex-col items-center text-center p-3 rounded-lg border border-divider bg-content1">
            <div className="w-6 h-6 rounded-full bg-content3 dark:bg-content2 flex items-center justify-center text-xs font-bold text-foreground dark:text-primary-foreground mb-2">
                {number}
            </div>
            <div className="text-xs font-medium text-foreground dark:text-primary-foreground">{title}</div>
            <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">{desc}</div>
        </div>
    )
}

const DISMISS_KEY = 'envis_cmd_warning_dismissed'
const DEFENDER_DISMISS_KEY = 'envis_defender_warning_dismissed'

function DefenderWarningBanner() {
    const { t } = useTranslation();
    const isWindows = navigator.userAgent.toLowerCase().includes('windows')
    const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem(DEFENDER_DISMISS_KEY) === '1' } catch { return false }
    })

    if (!isWindows || dismissed) return null

    const handleDismiss = () => {
        try { localStorage.setItem(DEFENDER_DISMISS_KEY, '1') } catch {}
        setDismissed(true)
    }

    return (
        <div className="rounded-xl border border-focus/30 bg-focus/10 dark:border-focus/30 dark:bg-focus/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-focus dark:text-focus shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                    <p className="text-xs font-semibold text-focus dark:text-focus">{t('welcome.defender_warning_title')}</p>
                    <p className="text-[11px] text-focus dark:text-focus leading-relaxed whitespace-pre-line">
                        {t('welcome.defender_warning_desc')}
                    </p>
                </div>
                <button
                    onClick={handleDismiss}
                    className="shrink-0 text-focus hover:text-focus dark:text-focus  dark:hover:text-focus transition-colors"
                    aria-label={t('welcome.dismiss')}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <details className="text-[11px] text-focus dark:text-focus">
                <summary className="cursor-pointer select-none font-medium hover:text-focus  dark:hover:text-focus transition-colors">
                    {t('welcome.defender_warning_steps')}
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-focus/10 dark:bg-overlay/30 text-focus  dark:text-focus text-[10px] space-y-2 leading-relaxed">
                    <p className="font-semibold">{t('welcome.defender_exclude_steps_title')}</p>
                    <ol className="list-decimal list-inside space-y-1.5 ml-1">
                        <li>{t('welcome.defender_step_1')}</li>
                        <li>{t('welcome.defender_step_2')}</li>
                        <li>{t('welcome.defender_step_3')}</li>
                        <li>{t('welcome.defender_step_4')}</li>
                        <li>{t('welcome.defender_step_5')}</li>
                        <li>{t('welcome.defender_step_6')}</li>
                    </ol>
                    <p className="mt-2 pt-2 border-t border-focus/30 dark:border-focus/20 text-focus dark:text-focus">
                        💡 {t('welcome.defender_tip')}
                    </p>
                </div>
            </details>
            <div className="flex justify-end">
                <button
                    onClick={handleDismiss}
                    className="text-[10px] text-focus dark:text-focus underline underline-offset-2 hover:text-focus  dark:hover:text-focus transition-colors"
                >
                    {t('welcome.cmd_warning_dismiss')}
                </button>
            </div>
        </div>
    )
}

function CmdWarningBanner() {
    const { t } = useTranslation();
    const isWindows = navigator.userAgent.toLowerCase().includes('windows')
    const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
    })

    if (!isWindows || dismissed) return null

    const handleDismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
        setDismissed(true)
    }

    const cmdExample = t('welcome.cmd_warning_script_example')

    return (
        <div className="rounded-xl border border-warning/30 bg-warning/10 dark:border-warning/30 dark:bg-warning/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-warning dark:text-warning shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                    <p className="text-xs font-semibold text-warning dark:text-warning">{t('welcome.cmd_warning_title')}</p>
                    <p className="text-[11px] text-warning dark:text-warning leading-relaxed whitespace-pre-line">{t('welcome.cmd_warning_desc')}</p>
                </div>
                <button
                    onClick={handleDismiss}
                    className="shrink-0 text-warning hover:text-warning dark:text-warning dark:hover:text-warning transition-colors"
                    aria-label={t('welcome.dismiss')}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <details className="text-[11px] text-warning dark:text-warning">
                <summary className="cursor-pointer select-none font-medium hover:text-warning dark:hover:text-warning transition-colors">
                    {t('welcome.cmd_warning_example')}
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-warning/15 dark:bg-overlay/30 text-warning dark:text-warning font-mono text-[10px] overflow-x-auto leading-relaxed whitespace-pre">
{cmdExample}
                </pre>
            </details>
            <div className="flex justify-end">
                <button
                    onClick={handleDismiss}
                    className="text-[10px] text-warning dark:text-warning underline underline-offset-2 hover:text-warning dark:hover:text-warning transition-colors"
                >
                    {t('welcome.cmd_warning_dismiss')}
                </button>
            </div>
        </div>
    )
}
