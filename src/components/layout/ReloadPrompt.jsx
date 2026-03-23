import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="reload-prompt">
      <RefreshCw size={16} />
      <span>Nueva versión disponible</span>
      <button onClick={() => updateServiceWorker(true)}>Actualizar</button>
    </div>
  )
}
