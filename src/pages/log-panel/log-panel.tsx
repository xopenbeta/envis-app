import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { cn, safeStringify } from '@/lib/utils'
import { useAtom } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { autoScrollLogAtom, isLogPanelOpenAtom, logEntriesAtom, LogEntry } from '@/store/log'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { appSettingsAtom, isAppLoadingAtom, systemSettingsAtom } from '@/store/appSettings'
import { environmentsAtom, selectedEnvironmentIdAtom, selectedServiceDataIdAtom } from '@/store/environment'
import { chatMessagesAtom, isAIResponseLoadingAtom } from '@/store/ai'
import { X, Trash2, Copy, ChevronDown, Pause, RefreshCcw, ChevronRight } from 'lucide-react'
import { useEnvironmentServiceData } from '@/hooks/env-serv-data'
import { isAIPanelOpenAtom, isNavPanelOpenAtom } from '@/store'
import { useTranslation } from 'react-i18next'

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString()
}

function LevelBadge({ level }: { level: LogEntry['level'] }) {
  const color = level === 'error'
    ? 'text-red-500'
    : level === 'warn'
      ? 'text-yellow-500'
      : level === 'debug'
        ? 'text-blue-500'
        : 'text-green-500'
  return <span className={cn('text-xs font-medium', color)}>[{level.toUpperCase()}]</span>
}

function LogEntryItem({ entry }: { entry: LogEntry }) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(true)
  const hasMeta = entry.meta && Object.keys(entry.meta).length > 0

  return (
    <div className="text-xs">
      <div className="flex gap-2">
        <span className="text-muted-foreground min-w-[64px]">{formatTime(entry.time)}</span>
        <LevelBadge level={entry.level} />
        <span className="whitespace-pre-wrap break-words flex-1">{entry.message}</span>
        {hasMeta && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title={collapsed ? t('log_panel.expand_params') : t('log_panel.collapse_params')}
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', !collapsed && 'rotate-90')} />
          </button>
        )}
      </div>
      {hasMeta && !collapsed && (
        <div className="mt-1 ml-[74px] pl-2 border-l border-muted">
          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words bg-muted/30 rounded p-1.5 max-h-32 overflow-auto">
            {safeStringify(entry.meta, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function LogPanel() {
  const { t } = useTranslation()
  const [entries, setEntries] = useAtom(logEntriesAtom)
  const [open, setOpen] = useAtom(isLogPanelOpenAtom)
  const [autoScroll, setAutoScroll] = useAtom(autoScrollLogAtom)
  const [ascending, setAscending] = useState(true)
  const [activeTab, setActiveTab] = useState<'logs' | 'state'>('logs')
  // height in px for the scrollable area (content). 14rem = 224px matches previous h-56.
  const [panelHeight, setPanelHeight] = useState<number>(224)
  const draggingRef = useRef<{ startY: number; startH: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  // state atoms
  const [appSettings] = useAtom(appSettingsAtom)
  const [systemSettings] = useAtom(systemSettingsAtom)
  const [isNavPanelOpen] = useAtom(isNavPanelOpenAtom)
  const [isAppLoading] = useAtom(isAppLoadingAtom)
  const [envs] = useAtom(environmentsAtom)
  const [selectedEnvId] = useAtom(selectedEnvironmentIdAtom)
  const [selectedServiceId] = useAtom(selectedServiceDataIdAtom)
  const { selectedServiceDatas } = useEnvironmentServiceData()
  const [isAIPanelOpen] = useAtom(isAIPanelOpenAtom)
  const [chatMessages] = useAtom(chatMessagesAtom)
  const [isAIResponseLoading] = useAtom(isAIResponseLoadingAtom)

  // Memoize display entries
  const displayEntries = useMemo(() => ascending ? entries : [...entries].reverse(), [entries, ascending])

  useEffect(() => {
    if (autoScroll && open && activeTab === 'logs') {
      if (!ascending) {
        // For descending order (newest at top), scroll to top when new entries arrive
        virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
      } 
      // For ascending order, Virtuoso's followOutput prop handles sticking to bottom
    }
  }, [entries.length, autoScroll, open, ascending, activeTab])

  // Drag handlers for resizing by dragging the header
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return
      const { startY, startH } = draggingRef.current
      const delta = startY - e.clientY // moving up (smaller Y) increases height
      const minH = 120
      const maxH = Math.max(160, window.innerHeight - 80) // leave some space for header/page
      const next = Math.min(Math.max(startH + delta, minH), maxH)
      setPanelHeight(next)
    }
    function onMouseUp() {
      if (!draggingRef.current) return
      draggingRef.current = null
      setDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging])

  const onHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Avoid starting drag when interacting with buttons in header
    if (target.closest('button')) return
    draggingRef.current = { startY: e.clientY, startH: panelHeight }
    setDragging(true)
    e.preventDefault()
  }

  const copyAll = async () => {
    const text = displayEntries.map(e => `[${formatTime(e.time)}] ${e.level.toUpperCase()} ${e.message}`).join('\n')
    await navigator.clipboard.writeText(text)
  }

  const clearAll = () => setEntries([])

  // ===== State Tab helpers =====

  const stateSummary = useMemo(() => ({
    app: {
      appSettings,
      systemSettings,
      isLeftPanelOpen: isNavPanelOpen,
      isAppLoading,
    },
    environment: {
      environmentsCount: envs?.length ?? 0,
      selectedEnvironmentId: selectedEnvId,
      environments: envs,
    },
    service: {
      selectedServiceDataId: selectedServiceId,
      selectedEnvServDatasCount: selectedServiceDatas?.length ?? 0,
      selectedEnvServDatas: selectedServiceDatas,
    },
    ai: {
      isAIPanelOpen,
      isAIResponseLoading,
      chatMessagesCount: chatMessages?.length ?? 0,
      chatMessages,
    },
    log: {
      logEntriesCount: entries?.length ?? 0,
      autoScroll,
    },
  }), [appSettings, systemSettings, isNavPanelOpen, isAppLoading, envs, selectedEnvId, selectedServiceId, selectedServiceDatas, isAIPanelOpen, isAIResponseLoading, chatMessages, entries, autoScroll])

  const copyAllState = async () => {
    await navigator.clipboard.writeText(safeStringify(stateSummary, 2))
  }

  if (!open) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 px-1 pb-1 pointer-events-none">
      <div className="bg-content2 border rounded-lg heroui-card pointer-events-auto overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'logs' | 'state')}>
          {/* Header with Tabs */}
          <div
            className={cn(
              'flex items-center justify-between px-2 py-1 border-b select-none',
              'cursor-ns-resize'
            )}
            onMouseDown={onHeaderMouseDown}
            title={t('log_panel.drag_resize')}
          >
            <div className="flex items-center gap-2">
              <TabsList>
                <TabsTrigger value="logs">{t('log_panel.logs_tab')}</TabsTrigger>
                <TabsTrigger value="state">{t('log_panel.state_tab')}</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex items-center gap-1">
              {activeTab === 'logs' ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setAscending(v => !v)}
                    title={ascending ? t('log_panel.switch_desc') : t('log_panel.switch_asc')}
                  >
                    <span className="text-xs">{ascending ? t('log_panel.asc') : t('log_panel.desc')}</span>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAutoScroll(v => !v)} title={autoScroll ? t('log_panel.pause_scroll') : t('log_panel.enable_scroll')}>
                    {autoScroll ? <Pause className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyAll} title={t('log_panel.copy_all')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={clearAll} title={t('log_panel.clear_all')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyAllState} title={t('log_panel.copy_state')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => location.reload()} title={t('log_panel.refresh')}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpen(false)} title={t('log_panel.close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <TabsContent value="logs">
            <div style={{ height: panelHeight }}>
              {entries.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">{t('log_panel.no_logs')}</div>
              ) : (
                <Virtuoso
                  ref={virtuosoRef}
                  style={{ height: '100%' }}
                  data={displayEntries}
                  followOutput={autoScroll && ascending ? 'auto' : false}
                  atBottomStateChange={(atBottom) => {
                    // Optional: If user manually scrolls up, we might want to pause autoScroll 
                    // or just let them scroll. The current implementation has a manual toggle for autoScroll.
                    // If we wanted to auto-pause: if (!atBottom) setAutoScroll(false)
                  }}
                  itemContent={(index, entry) => (
                    <div className="px-3 py-0.5">
                      <LogEntryItem entry={entry} />
                    </div>
                  )}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="state">
            <div style={{ height: panelHeight }}>
              <ScrollArea className="h-full w-full">
                <div className="px-2 py-1">
                  <Accordion type="multiple" defaultValue={["app","env","service","ai","log"]} className="w-full">
                    <AccordionItem value="app">
                      <AccordionTrigger className="py-2 text-xs">{t('log_panel.app')}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <div>
                            <div className="text-[11px] leading-tight text-muted-foreground mb-1">appSettings</div>
                            <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words bg-muted/30 rounded p-2 max-h-40 overflow-auto">{safeStringify(appSettings, 2)}</pre>
                          </div>
                          <div>
                            <div className="text-[11px] leading-tight text-muted-foreground mb-1">systemSettings</div>
                            <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words bg-muted/30 rounded p-2 max-h-40 overflow-auto">{safeStringify(systemSettings, 2)}</pre>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                            <div className="bg-muted/30 rounded p-2">isLeftPanelOpen: {String(isNavPanelOpen)}</div>
                            <div className="bg-muted/30 rounded p-2">isAppLoading: {String(isAppLoading)}</div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="env">
                      <AccordionTrigger className="py-2 text-xs">{t('log_panel.environment')}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                            <div className="bg-muted/30 rounded p-2">selectedEnvironmentId: {selectedEnvId || '-'}</div>
                            <div className="bg-muted/30 rounded p-2">environmentsCount: {envs?.length ?? 0}</div>
                          </div>
                          <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words bg-muted/30 rounded p-2 max-h-40 overflow-auto">{safeStringify(envs, 2)}</pre>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="service">
                      <AccordionTrigger className="py-2 text-xs">{t('log_panel.service')}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                            <div className="bg-muted/30 rounded p-2">selectedServiceDataId: {selectedServiceId || '-'}</div>
                            <div className="bg-muted/30 rounded p-2">selectedEnvServDatasCount: {selectedServiceDatas?.length ?? 0}</div>
                          </div>
                          <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words bg-muted/30 rounded p-2 max-h-40 overflow-auto">{safeStringify(selectedServiceDatas, 2)}</pre>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="ai">
                      <AccordionTrigger className="py-2 text-xs">{t('log_panel.ai')}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-[11px] leading-tight">
                            <div className="bg-muted/30 rounded p-2">isAIPanelOpen: {String(isAIPanelOpen)}</div>
                            <div className="bg-muted/30 rounded p-2">isAIResponseLoading: {String(isAIResponseLoading)}</div>
                            <div className="bg-muted/30 rounded p-2">chatMessagesCount: {chatMessages?.length ?? 0}</div>
                          </div>
                          <pre className="text-[11px] leading-tight whitespace-pre-wrap break-words bg-muted/30 rounded p-2 max-h-40 overflow-auto">{safeStringify(chatMessages, 2)}</pre>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="log">
                      <AccordionTrigger className="py-2 text-xs">Log ({t('log_panel.meta_info')})</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                          <div className="bg-muted/30 rounded p-2">logEntriesCount: {entries?.length ?? 0}</div>
                          <div className="bg-muted/30 rounded p-2">autoScroll: {String(autoScroll)}</div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
