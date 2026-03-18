import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useTenant } from '../context/TenantContext'
import { useData } from '../context/DataContext'
import { useTour } from './AppTour'
import { useToast } from './Toast'
import { supabase } from '../../apiClient'
import { setCurrency } from '../../utils/money'
import { COUNTRIES, COUNTRY_CURRENCY } from '../../config/currencies'
import { API_URL, TOKEN_KEY, SESSION_KEY } from '../../config/constants'
import PasswordInput from '../shared/PasswordInput'
import ConfirmDeleteModal from '../shared/ConfirmDeleteModal'
import {
  X, User, Droplets, ShoppingBag, Users, TrendingUp, TrendingDown,
  MessageCircle, Crown, Sun, Moon, Star,
  HelpCircle, Globe, Wallet, ArrowLeft,
  Trash2, ChevronDown, LogOut,
  Mail, Lock, Shield, Building2, Instagram, Music2,
} from 'lucide-react'

function MisDatosPopup({ onBack }) {
  const navigate = useNavigate()
  const { userProfile, isPro, refresh, userEmail, negocioNombre, pais, currencyCode } = useTenant()
  const { negocioId } = useData()
  const toast = useToast()
  const isAdmin = (userProfile?.rol || 'admin') === 'admin'

  const [editingField, setEditingField] = useState(null)
  const [emailEdit, setEmailEdit] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [negocioNombreEdit, setNegocioNombreEdit] = useState('')
  const [datosError, setDatosError] = useState('')
  const [datosSaving, setDatosSaving] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [paisEdit, setPaisEdit] = useState(pais)
  const [showTypeConfirm, setShowTypeConfirm] = useState(false)
  const [typeConfirmText, setTypeConfirmText] = useState('')

  const cancelEdit = () => {
    setEditingField(null)
    setDatosError('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSaveNegocioNombre = async () => {
    if (!negocioNombreEdit.trim()) return
    setDatosSaving(true)
    const { error } = await supabase
      .from('negocios')
      .update({ nombre: negocioNombreEdit.trim() })
      .eq('id', negocioId)
    setDatosSaving(false)
    if (error) {
      setDatosError('Error al guardar: ' + error.message)
    } else {
      refresh()
      cancelEdit()
    }
  }

  const handleSaveEmail = async () => {
    if (!emailEdit.trim() || !currentPassword) return
    setDatosError('')
    setDatosSaving(true)
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/auth/update-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newEmail: emailEdit.trim() }),
      })
      const result = await res.json()
      setDatosSaving(false)
      if (result.error) {
        setDatosError(result.error)
      } else {
        if (result.data?.session) {
          localStorage.setItem(TOKEN_KEY, result.data.session.access_token)
          localStorage.setItem(SESSION_KEY, JSON.stringify(result.data.session))
        }
        refresh()
        cancelEdit()
      }
    } catch {
      setDatosSaving(false)
      setDatosError('Error de conexión')
    }
  }

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword) return
    if (newPassword !== confirmPassword) {
      setDatosError('Las contraseñas no coinciden')
      return
    }
    if (newPassword.length < 6) {
      setDatosError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setDatosError('')
    setDatosSaving(true)
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_URL}/api/auth/update-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const result = await res.json()
      setDatosSaving(false)
      if (result.error) {
        setDatosError(result.error)
      } else {
        cancelEdit()
        toast.success('Contraseña actualizada')
      }
    } catch {
      setDatosSaving(false)
      setDatosError('Error de conexión')
    }
  }

  const handleSavePais = async () => {
    if (paisEdit === pais) { cancelEdit(); return }
    setDatosSaving(true)
    const moneda = COUNTRY_CURRENCY[paisEdit] || 'COP'
    const { error } = await supabase
      .from('negocios')
      .update({ pais: paisEdit, moneda })
      .eq('id', negocioId)
    setDatosSaving(false)
    if (error) {
      setDatosError('Error al guardar: ' + error.message)
    } else {
      setCurrency(moneda)
      refresh()
      cancelEdit()
    }
  }

  const handleDeleteAccount = () => {
    setShowDeleteAccount(false)
    setShowTypeConfirm(true)
    setTypeConfirmText('')
  }

  const executeDeleteAccount = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const res = await fetch(`${API_URL}/api/auth/account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!data.success) {
      setDatosError(data.error || 'Error al eliminar la cuenta')
      return
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
    navigate('/')
  }

  const handleBack = () => {
    onBack()
  }

  const isEditing = (field) => editingField === field
  const canEdit = (field) => editingField === null
  const openEdit = (field, setup) => {
    if (editingField !== null) return
    setup?.()
    setEditingField(field)
  }

  const fields = [
    {
      key: 'email',
      label: 'Correo electrónico',
      value: userEmail || '—',
      icon: Mail,
      color: 'msettings-icon--blue',
      editable: true,
      onOpen: () => setEmailEdit(userEmail || ''),
      onSave: handleSaveEmail,
      editContent: (
        <>
          <input type="email" className="misdatos-input" value={emailEdit} onChange={e => setEmailEdit(e.target.value)} placeholder="Nuevo correo" autoFocus />
          <PasswordInput className="misdatos-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" />
        </>
      ),
    },
    {
      key: 'password',
      label: 'Contraseña',
      value: '••••••••',
      icon: Lock,
      color: 'msettings-icon--purple',
      editable: true,
      onSave: handleSavePassword,
      editContent: (
        <>
          <PasswordInput className="misdatos-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" autoFocus />
          <PasswordInput className="misdatos-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña" />
          <PasswordInput className="misdatos-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmar nueva" />
        </>
      ),
    },
    {
      key: 'negocio',
      label: 'Nombre del negocio',
      value: negocioNombre || '—',
      icon: Building2,
      color: 'msettings-icon--cyan',
      editable: isAdmin,
      onOpen: () => setNegocioNombreEdit(negocioNombre || ''),
      onSave: handleSaveNegocioNombre,
      editContent: (
        <input type="text" className="misdatos-input" value={negocioNombreEdit} onChange={e => setNegocioNombreEdit(e.target.value)} autoFocus />
      ),
    },
    ...(isAdmin ? [{
      key: 'pais',
      label: 'País / Moneda',
      value: `${COUNTRIES.find(c => c.code === pais)?.flag || ''} ${COUNTRIES.find(c => c.code === pais)?.name || pais} — ${currencyCode}`,
      icon: Globe,
      color: 'msettings-icon--teal',
      editable: true,
      onOpen: () => setPaisEdit(pais),
      onSave: handleSavePais,
      editContent: (
        <div className="country-selector-grid country-selector-mobile">
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              type="button"
              className={`country-chip ${paisEdit === c.code ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setPaisEdit(c.code) }}
            >
              <span className="country-flag">{c.flag}</span>
              <span className="country-name">{c.name}</span>
            </button>
          ))}
        </div>
      ),
    }] : []),
    {
      key: 'rol',
      label: 'Rol',
      value: userProfile?.rol || 'admin',
      icon: Shield,
      color: 'msettings-icon--gray',
      editable: false,
    },
  ]

  return (
    <div
      className="misdatos-overlay"
    >
      <div className="misdatos-panel">
        <div className="misdatos-header">
          <button className="misdatos-back" onClick={handleBack}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="misdatos-title">Mis Datos</h2>
        </div>

        <div className="misdatos-scroll">
          {datosError && <div className="misdatos-error">{datosError}</div>}

          {fields.map(f => {
            const editing = isEditing(f.key)
            const Icon = f.icon
            return (
              <div
                key={f.key}
                className={`misdatos-card${editing ? ' misdatos-card--editing' : ''}${!f.editable ? ' misdatos-card--readonly' : ''}`}
                onClick={() => f.editable && (editing ? cancelEdit() : canEdit(f.key) && openEdit(f.key, f.onOpen))}
              >
                <div className="misdatos-card-top">
                  <span className={`msettings-icon ${f.color}`}><Icon size={20} /></span>
                  <div className="misdatos-card-text">
                    <span className="misdatos-card-label">{f.label}</span>
                    <span className="misdatos-card-value">{f.value}</span>
                  </div>
                  {f.editable && (
                    <ChevronDown size={18} className={`misdatos-card-chevron${editing ? ' rotated' : ''}`} />
                  )}
                </div>
                {editing && (
                  <div className="misdatos-card-expand">
                    {f.editContent}
                    <button className="misdatos-save-btn" onClick={e => { e.stopPropagation(); f.onSave() }} disabled={datosSaving}>
                      {datosSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Eliminar cuenta */}
          {isAdmin && (
            <div
              className={`misdatos-card misdatos-card--delete${showDeleteZone ? ' misdatos-card--editing' : ''}`}
              onClick={() => setShowDeleteZone(prev => !prev)}
            >
              <div className="misdatos-card-top">
                <span className="msettings-icon msettings-icon--red"><Trash2 size={20} /></span>
                <div className="misdatos-card-text">
                  <span className="misdatos-card-label misdatos-card-label--red">Eliminar mi cuenta</span>
                  <span className="misdatos-card-value">Borrar todos los datos</span>
                </div>
                <ChevronDown size={18} className={`misdatos-card-chevron${showDeleteZone ? ' rotated' : ''}`} />
              </div>
              {showDeleteZone && (
                <div className="misdatos-card-expand" onClick={e => e.stopPropagation()}>
                  <p className="misdatos-delete-warning">Se eliminarán permanentemente todos los datos de tu negocio y tu cuenta.</p>
                  <button className="misdatos-save-btn misdatos-save-btn--red" onClick={() => setShowDeleteAccount(true)}>
                    Eliminar mi cuenta
                  </button>
                  <button className="misdatos-cancel-link" onClick={() => setShowDeleteZone(false)}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteAccount && (
        <ConfirmDeleteModal
          isOpen
          onClose={() => setShowDeleteAccount(false)}
          onConfirm={handleDeleteAccount}
          message="Se eliminarán TODOS los datos de tu negocio: clientes, lavadas, pagos, trabajadores, configuración y tu cuenta de usuario. Esta acción es permanente y no se puede deshacer."
        />
      )}

      {showTypeConfirm && (
        <div className="modal-overlay confirm-delete-overlay">
          <div className="modal confirm-delete-modal">
            <div className="modal-header">
              <h2>Confirmación final</h2>
              <button className="btn-close" onClick={() => setShowTypeConfirm(false)}><X size={24} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Escribe <strong>eliminar</strong> para confirmar.
              </p>
              <div className="form-group">
                <input type="text" className="form-control" placeholder='Escribe "eliminar"' value={typeConfirmText} onChange={e => setTypeConfirmText(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTypeConfirm(false)}>Cancelar</button>
              <button className="btn-primary" style={{ background: 'var(--accent-red)' }} disabled={typeConfirmText.toLowerCase() !== 'eliminar'} onClick={executeDeleteAccount}>
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MobileSettings({ onClose }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { isPro, userProfile } = useTenant()
  const { startTour } = useTour()
  const isAdmin = (userProfile?.rol || 'admin') === 'admin'
  const [showMisDatos, setShowMisDatos] = useState(false)
  const [showRedes, setShowRedes] = useState(false)
  const [closing, setClosing] = useState(false)

  const animateClose = (cb) => {
    setClosing(true)
    setTimeout(cb, 250)
  }

  const go = (path) => {
    animateClose(() => { onClose(); navigate(path) })
  }

  const handleLogout = async () => {
    animateClose(async () => { onClose(); await supabase.auth.signOut(); window.location.href = '/' })
  }

  const handleTour = () => {
    animateClose(() => { onClose(); localStorage.removeItem('monaco_tour_completed'); startTour() })
  }

  const openMisDatos = () => setShowMisDatos(true)

  return (
    <div className={`msettings-overlay ${closing ? 'msettings-closing' : ''}`}>
      <div className="msettings-panel">
        {/* Header */}
        <div className="msettings-header">
          <h1 className="msettings-title">Configuraciones</h1>
          <button className="msettings-close" onClick={() => animateClose(onClose)}>
            <X size={22} />
          </button>
        </div>

        <div className="msettings-scroll">
          {/* Mi Cuenta */}
          <p className="msettings-category">Mi Cuenta</p>
          <button className="msettings-item" onClick={openMisDatos}>
            <span className="msettings-icon msettings-icon--blue"><User size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Mis Datos</span>
              <span className="msettings-sub">Correo, contraseña y perfil</span>
            </span>
          </button>

          {/* Contenido */}
          <p className="msettings-category">Contenido</p>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=lavados')}>
            <span className="msettings-icon msettings-icon--blue"><Droplets size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Servicios</span>
              <span className="msettings-sub">Tipos de lavado y adicionales</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=productos')}>
            <span className="msettings-icon msettings-icon--blue"><ShoppingBag size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Mis Productos</span>
              <span className="msettings-sub">Inventario y precios</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=lavadores')}>
            <span className="msettings-icon msettings-icon--blue"><Users size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Trabajadores</span>
              <span className="msettings-sub">Lavadores y comisiones</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=cat_ingresos')}>
            <span className="msettings-icon msettings-icon--teal"><TrendingUp size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Ingresos</span>
              <span className="msettings-sub">Categorías de ingreso</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=cat_egresos')}>
            <span className="msettings-icon msettings-icon--red"><TrendingDown size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Egresos</span>
              <span className="msettings-sub">Categorías de egreso</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=metodos')}>
            <span className="msettings-icon msettings-icon--blue"><Wallet size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Métodos de Pago</span>
              <span className="msettings-sub">Efectivo, transferencia, etc.</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=mensajes')}>
            <span className="msettings-icon msettings-icon--blue"><MessageCircle size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Mensajes</span>
              <span className="msettings-sub">Plantillas de WhatsApp</span>
            </span>
          </button>
          <button className="msettings-item" onClick={() => go('/cuenta?tab=config&subtab=membresias')}>
            <span className="msettings-icon msettings-icon--blue"><Crown size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Membresías</span>
              <span className="msettings-sub">Tipos de cliente y descuentos</span>
            </span>
          </button>

          {/* Otros */}
          <p className="msettings-category">Otros</p>
          <button className="msettings-item" onClick={toggleTheme}>
            <span className="msettings-icon msettings-icon--gray">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </span>
            <span className="msettings-text">
              <span className="msettings-label">Apariencia</span>
              <span className="msettings-sub">{theme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado'}</span>
            </span>
          </button>
          {isAdmin && (
            <button className="msettings-item" onClick={() => go('/cuenta?tab=plan')}>
              <span className="msettings-icon msettings-icon--gold"><Star size={20} /></span>
              <span className="msettings-text">
                <span className="msettings-label">Monaco PRO</span>
                <span className="msettings-sub">{isPro ? 'Plan activo' : 'Actualiza tu plan'}</span>
              </span>
            </button>
          )}
          <button className="msettings-item" onClick={handleTour}>
            <span className="msettings-icon msettings-icon--blue"><HelpCircle size={20} /></span>
            <span className="msettings-text">
              <span className="msettings-label">Cómo usar la app</span>
              <span className="msettings-sub">Repetir tutorial guiado</span>
            </span>
          </button>

          {/* Text links */}
          <div className="msettings-links">
            <a
              href="https://wa.me/573144016349?text=Hola%2C%20necesito%20ayuda%20con%20Monaco"
              target="_blank"
              rel="noopener noreferrer"
              className="msettings-link"
            >
              Soporte
            </a>
            <button className="msettings-link" onClick={() => setShowRedes(prev => !prev)}>
              Redes sociales <ChevronDown size={14} className={showRedes ? 'rotated' : ''} style={{ transition: 'transform 0.2s' }} />
            </button>
            {showRedes && (
              <div className="msettings-redes">
                <a href="https://www.instagram.com/monaco_motodetailing/" target="_blank" rel="noopener noreferrer" className="msettings-redes-item">
                  <Instagram size={18} /> @monaco_motodetailing
                </a>
                <a href="https://www.tiktok.com/@monaco_motodetailing" target="_blank" rel="noopener noreferrer" className="msettings-redes-item">
                  <Music2 size={18} /> @monaco_motodetailing
                </a>
                <a href="https://monacomotodetailing.com" target="_blank" rel="noopener noreferrer" className="msettings-redes-item">
                  <Globe size={18} /> Monaco Moto Detailing
                </a>
                <a href="https://themonaco.com.co" target="_blank" rel="noopener noreferrer" className="msettings-redes-item">
                  <Globe size={18} /> Monaco PRO
                </a>
              </div>
            )}
          </div>

          {/* Logout — outside scroll, at bottom */}
          <button className="msettings-logout" onClick={handleLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>

          {/* Footer */}
          <p className="msettings-footer">App creada por Monaco</p>
        </div>
      </div>

      {showMisDatos && (
        <MisDatosPopup onBack={() => setShowMisDatos(false)} />
      )}
    </div>
  )
}
