import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ServiceList } from "./service-data-list/service-data-list"
import { ServiceDetailRouter } from "./service-data-panel/service-router"

export function EnvironmentPanel({ onOpen }: {
  onOpen?: () => void
}) {

  return (
    <ResizablePanelGroup direction="horizontal">
        {/* Service List */}
        <ResizablePanel defaultSize={30} minSize={10} maxSize={60}>
          <ServiceList onOpen={onOpen} />
        </ResizablePanel>

        <ResizableHandle className="w-px bg-border hover:bg-default heroui-transition" />

        {/* Service Detail or Dashboard */}
        <ResizablePanel defaultSize={69} minSize={40}>
            <ServiceDetailRouter />
        </ResizablePanel>
      </ResizablePanelGroup>
  )
}
