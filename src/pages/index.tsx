import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useAtom } from 'jotai'
import { useEffect, useRef, useState } from "react"
import { ImperativePanelHandle, ImperativePanelGroupHandle } from "react-resizable-panels"
import { EnvironmentPanel } from "./env-panel/env-panel"
import NavBar from "./nav-bar/nav-bar"
import { WelcomeFragment } from "./welcome-fragment"
import { selectedEnvironmentIdAtom, selectedServiceDataIdAtom, selectedServiceDatasAtom } from '../store/environment'
import LogPanel from './log-panel/log-panel'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { isNavPanelOpenAtom, isAIPanelOpenAtom, navPanelWidthRatioAtom, aiPanelWidthRatioAtom, isEnvPanelOpenAtom, envPanelWidthRatioAtom } from "@/store"
import { AIPanel } from "./ai-panel/ai-panel"
import { useServiceData } from "@/hooks/env-serv-data"

export default function Envis() {
  const [selectedEnvironmentId] = useAtom(selectedEnvironmentIdAtom);
  const [isNavPanelOpen, setIsNavPanelOpen] = useAtom(isNavPanelOpenAtom);
  const [navPanelWidthRatio, setNavPanelWidthRatio] = useAtom(navPanelWidthRatioAtom);
  const [isEnvPanelOpen, setIsEnvPanelOpen] = useAtom(isEnvPanelOpenAtom);
  const [envPanelWidthRatio, setEnvPanelWidthRatio] = useAtom(envPanelWidthRatioAtom);
  const [isAIPanelOpen, setIsAIPanelOpen] = useAtom(isAIPanelOpenAtom);
  const [aiPanelWidthRatio, setAIPanelWidthRatio] = useAtom(aiPanelWidthRatioAtom);

  const navPanelRef = useRef<ImperativePanelHandle>(null);
  const envPanelRef = useRef<ImperativePanelHandle>(null);
  const aiPanelRef = useRef<ImperativePanelHandle>(null);
  const previousAIPanelOpenRef = useRef(isAIPanelOpen);

  useEffect(() => {
    if (isNavPanelOpen) {
      navPanelRef.current?.expand?.();
    } else {
      navPanelRef.current?.collapse?.();
    }
  }, [isNavPanelOpen]);

  useEffect(() => {
    aiPanelRef.current?.collapse?.();
  }, []);

  useEffect(() => {
    const adjustWindowSize = async () => {
      try {
        const win = getCurrentWindow();
        const physical = await win.innerSize(); // Physical 像素
        const scaleFactor = await win.scaleFactor();
        const logical = physical.toLogical(scaleFactor); // 转为 Logical（CSS px）

        let aiPanelWidth = logical.width * (aiPanelWidthRatio / 100);
        if (isAIPanelOpen) {
          // width*ratio = x(1-ratio)
          // x = width*radio/(1-ratio)
          aiPanelWidth = logical.width * (aiPanelWidthRatio / 100) / (1 - (aiPanelWidthRatio / 100));
        }
        const nextWindowWidth = isAIPanelOpen ? logical.width + aiPanelWidth : logical.width - aiPanelWidth;
        await win.setSize(new LogicalSize(nextWindowWidth, logical.height));

        // 保持导航栏实际像素宽度不变：根据新窗口宽度重新设置左侧 Panel 的百分比
        const navPanelWidth = logical.width * (navPanelWidthRatio / 100); // 变更前的像素宽度
        const nextNavWidthRatio = (navPanelWidth / nextWindowWidth) * 100; // 变更后的百分比
        const nextEnvWidthRatio = 100 - nextNavWidthRatio - (isAIPanelOpen ? aiPanelWidthRatio : 0);
        setNavPanelWidthRatio(nextNavWidthRatio);
        setEnvPanelWidthRatio(nextEnvWidthRatio);
        navPanelRef.current?.resize(nextNavWidthRatio);
        envPanelRef.current?.resize(nextEnvWidthRatio);
        aiPanelRef.current?.resize(aiPanelWidthRatio);

        if (isAIPanelOpen) {
          aiPanelRef.current?.expand?.();
        } else {
          aiPanelRef.current?.collapse?.();
        }
        console.log('zws 窗口大小调整完成:', aiPanelWidthRatio, aiPanelWidth, logical.width, nextWindowWidth);
      } catch (error) {
        console.error('调整窗口大小失败:', error);
      }
    };

    if (previousAIPanelOpenRef.current !== isAIPanelOpen) {
      adjustWindowSize();
    }
    previousAIPanelOpenRef.current = isAIPanelOpen;
  }, [isAIPanelOpen, aiPanelWidthRatio]);

  const resizableHandleClassName = "w-px bg-content2 hover:bg-default heroui-transition";
  return <div className="fixed w-screen h-screen overflow-hidden bg-content2">
    <ResizablePanelGroup direction="horizontal" className="w-screen h-screen">

      {/* 导航栏 */}
      <ResizablePanel
        ref={navPanelRef}
        defaultSize={navPanelWidthRatio}
        collapsedSize={0}
        collapsible={true}
        minSize={10}
        className="min-w-0"
        animateCollapse={true}
        onResize={(size) => {
          if (isNavPanelOpen) setNavPanelWidthRatio(size);
        }}
      >
        <NavBar onClose={() => setIsNavPanelOpen(false)} />
      </ResizablePanel>

      {/* 拖动线 */}
      <ResizableHandle className={resizableHandleClassName} />

      {/* 主体内容 */}
      <ResizablePanel
        ref={envPanelRef}
        defaultSize={envPanelWidthRatio}
        minSize={20}
        onResize={(size) => {
          if (isEnvPanelOpen) setEnvPanelWidthRatio(size);
        }}
      >
        <div className='w-full h-screen flex justify-center items-center'>
          <div style={{ width: 'calc(100% - 8px)', height: 'calc(100vh - 10px)' }} className="bg-white dark:bg-[#030303] flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-white/5 shadow-sm">
            {selectedEnvironmentId ? (
              <EnvironmentPanel onOpen={isNavPanelOpen ? undefined : () => setIsNavPanelOpen(true)} />
            ) : (
              <WelcomeFragment onOpen={isNavPanelOpen ? undefined : () => setIsNavPanelOpen(true)} />
            )}
          </div>
        </div>
      </ResizablePanel>

      {/* 拖动线 */}
      <ResizableHandle className={resizableHandleClassName} />

      {/* AI面板 */}
      <ResizablePanel
        ref={aiPanelRef}
        defaultSize={20}
        collapsedSize={0}
        collapsible={true}
        minSize={20}
        maxSize={50}
        onResize={(size) => {
          if (isAIPanelOpen) setAIPanelWidthRatio(size);
        }}
      >
        <div className='w-full h-full flex items-center'>
          <div style={{ width: 'calc(100% - 5px)', height: 'calc(100% - 10px)' }} className="bg-white dark:bg-content3 flex flex-col overflow-hidden rounded-lg border">
            <AIPanel onClose={() => setIsAIPanelOpen(false)} />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
    <LogPanel />
  </div>
}
