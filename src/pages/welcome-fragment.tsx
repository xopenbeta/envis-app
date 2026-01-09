import { Button } from "@/components/ui/button";
import { isAIPanelOpenAtom } from "@/store";
import { useAtom } from "jotai";
import { useState } from "react";
import { Github, Server, Code, Database, Settings, PanelLeft, Bot, Zap, Globe, Box, Layers, Terminal, Command, Cpu, Plus, FolderOpen, Book, Clock, ArrowRight, Search, GripVertical, Play, Square, Hexagon, Info, MemoryStick, HardDrive, Wifi, Users, MessageCircle, MessageSquare } from "lucide-react";
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
import { environmentsAtom } from '@/store/environment'
import { useEnvironment } from '@/hooks/environment'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { Environment, EnvironmentStatus } from '@/types/index'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "@/components/ui/pie-chart";
import { Progress } from "@/components/ui/progress";
import { SystemMonitor, useSystemMonitorData } from '@/pages/system-monitor';
import { AppFooter } from "@/pages/app-footer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { t } from "i18next";

export function WelcomeFragment({ onOpen }: {
    onOpen?: () => void;
}) {
    const [, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom)
    const [environments] = useAtom(environmentsAtom)
    const { updateEnvironmentsOrder } = useEnvironment()
    const { switchEnvAndServDatasActive } = useEnvironmentServiceData()
    const systemInfo = useSystemMonitorData()
    const [showContactDialog, setShowContactDialog] = useState(false);
    const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const onDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = environments.findIndex((item) => item.id === active.id);
            const newIndex = environments.findIndex((item) => item.id === over?.id);
            const newEnvironments = arrayMove(environments, oldIndex, newIndex);
            await updateEnvironmentsOrder(newEnvironments);
        }
    };

    const handleToggleActive = async (env: Environment, e: React.MouseEvent) => {
        e.stopPropagation();
        await switchEnvAndServDatasActive(env);
    }

    return (
        <div className="relative w-full h-full bg-white dark:bg-[#030303] text-gray-900 dark:text-white overflow-hidden flex flex-col font-sans selection:bg-blue-500/20 dark:selection:bg-white/20">
            {/* Cursor-style Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* Subtle gradient glow at the top */}
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-black/[0.02] dark:bg-white/[0.03] blur-[120px] rounded-full"></div>
                
                {/* Grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
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
                    className="absolute top-1.5 left-2 z-50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all h-8 w-8"
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
                className="absolute top-1.5 right-2 z-50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all h-8 w-8"
            >
                <Bot className="h-4 w-4" />
            </Button>

            {/* Main Content - App Welcome Screen */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center">
                <div className="w-full max-w-2xl px-6 flex flex-col gap-8">
                    
                    {/* Brand Header */}
                    <div className="text-center space-y-4 mt-12">
                        <div className="w-full flex justify-center">
                            <a
                                href="https://github.com/xopenbeta/envis-app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20"
                            >
                                <Github className="w-4 h-4" />
                                <span className="text-xs">{t('welcome.github_star')}</span>
                                <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                            </a>
                        </div>
                        <div>
                            <h1 className="text-3xl font-medium tracking-tight text-gray-900 dark:text-white mb-2">Envis</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('welcome.subtitle')}</p>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ActionCard 
                            icon={<Plus className="w-5 h-5 text-blue-500 dark:text-blue-400" />} 
                            title={t('welcome.new_environment')}
                            desc={t('welcome.new_environment_desc')}
                            onClick={onOpen}
                        />
                        <ActionCard 
                            icon={<Terminal className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />} 
                            title={t('welcome.open_terminal')}
                            desc={t('welcome.open_terminal_desc')}
                        />
                        <ActionCard 
                            icon={<Zap className="w-5 h-5 text-purple-500 dark:text-purple-400" />} 
                            title={t('welcome.ai_assistant')}
                            desc={t('welcome.ai_assistant_desc')}
                            onClick={() => setIsAIPanelOpen(true)}
                        />
                        <ActionCard 
                            icon={<Book className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />} 
                            title={t('welcome.documentation')}
                            desc={t('welcome.documentation_desc')}
                            onClick={() => window.open('https://github.com/xopenbeta/envis-app', '_blank')}
                        />
                    </div>

                    {/* Usage Scenarios */}
                    <div className="space-y-3">
                        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">{t('welcome.use_cases')}</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                {
                                    icon: <Zap className="w-5 h-5 text-orange-500 dark:text-orange-400" />,
                                    title: t('welcome.rapid_setup'),
                                    description: t('welcome.rapid_setup_desc')
                                },
                                {
                                    icon: <Layers className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
                                    title: t('welcome.multi_project'),
                                    description: t('welcome.multi_project_desc')
                                },
                                {
                                    icon: <Users className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
                                    title: t('welcome.team_standardization'),
                                    description: t('welcome.team_standardization_desc')
                                }
                            ].map((scenario, index) => (
                                <div key={index} className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/10 transition-all group">
                                    <div className="mt-1 p-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 group-hover:border-gray-300 dark:group-hover:border-white/10 transition-colors shrink-0">
                                        {scenario.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{scenario.title}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{scenario.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Getting Started */}
                    <div className="space-y-3">
                        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">{t('welcome.getting_started')}</h2>
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
                        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">{t('welcome.feedback')}</h2>
                        <div className="flex flex-col rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] overflow-hidden">
                            <a 
                                href="https://github.com/xopenbeta/daji-app" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-gray-200 dark:border-white/5 last:border-0"
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-white">
                                    <Github className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white">Github</div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{t('welcome.feedback_desc')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                            </a>
                            
                            <div 
                                onClick={() => setShowContactDialog(true)}
                                className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-gray-200 dark:border-white/5 last:border-0"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <MessageCircle className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white">QQ</div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{t('welcome.join_qq')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                            </div>

                            <div 
                                onClick={() => setShowContactDialog(true)}
                                className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-900 dark:text-white">{t('welcome.wechat')}</div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400">{t('welcome.join_wechat')}</div>
                                </div>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
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
                        <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                <MessageCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">{t('welcome.qq_group')}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{t('welcome.qq_group_id', { id: '1036572489' })}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                            <div className="p-2 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-medium text-gray-900 dark:text-white">{t('welcome.wechat_group')}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{t('welcome.wechat_group_desc')}</div>
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
            className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/10 transition-all text-left group"
        >
            <div className="mt-1 p-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 group-hover:border-gray-300 dark:group-hover:border-white/10 transition-colors">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
        </button>
    )
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
    return (
        <div className="flex flex-col items-center text-center p-3 rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-white mb-2">
                {number}
            </div>
            <div className="text-xs font-medium text-gray-900 dark:text-white">{title}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">{desc}</div>
        </div>
    )
}
