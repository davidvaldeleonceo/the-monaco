import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({ value, onChange, placeholder, className, autoFocus, onKeyDown, ...rest }) {
  const [show, setShow] = useState(false)

  return (
    <div className="password-input-wrapper">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        {...rest}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow(s => !s)}
        title={show ? 'Ocultar contraseña' : 'Ver contraseña'}
        tabIndex={-1}
        aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'}
      >
        {show ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
      </button>
    </div>
  )
}
