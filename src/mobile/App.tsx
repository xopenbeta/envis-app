import AndroidTerminalPanel from './pages/android-terminal-panel'
import { detectMobilePlatform } from './platform/adapter'

function App(): JSX.Element {
  const platform = detectMobilePlatform()

  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#1d4ed8_0%,#020617_35%,#020617_100%)]">
      <div className="h-full w-full md:max-w-3xl mx-auto border-x border-slate-800/70 shadow-2xl shadow-cyan-900/30">
        <div className="h-full w-full flex flex-col">
          <div className="px-4 py-2 border-b border-slate-800 text-[11px] text-slate-300 bg-slate-900/70">
            Mobile platform: {platform.platform} | Touch: {platform.isTouchDevice ? 'yes' : 'no'}
          </div>
          <div className="flex-1 min-h-0">
            <AndroidTerminalPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
