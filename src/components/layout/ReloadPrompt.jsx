import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  const handleUpdate = async () => {
    try {
      await updateServiceWorker(true)
    } catch {
      // fallback
    }
    window.location.reload()
  }

  return (
    <div className="reload-prompt">
      <RefreshCw size={16} />
      <span>Nueva versión disponible</span>
      <button onClick={handleUpdate}>Actualizar</button>
    </div>
  )
}
