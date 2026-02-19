-- Monaco PRO Database Schema
-- Replaces Supabase with self-hosted PostgreSQL

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  setup_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'admin',
  lavador_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BUSINESS DATA TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS tipos_membresia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio NUMERIC DEFAULT 0,
  descuento NUMERIC DEFAULT 0,
  cashback NUMERIC DEFAULT 0,
  duracion_dias INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cedula TEXT,
  telefono TEXT,
  correo TEXT,
  placa TEXT NOT NULL,
  moto TEXT,
  membresia_id UUID REFERENCES tipos_membresia(id) ON DELETE SET NULL,
  fecha_inicio_membresia DATE,
  fecha_fin_membresia DATE,
  estado TEXT DEFAULT 'Activo',
  cashback_acumulado NUMERIC DEFAULT 0,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tipos_lavado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio NUMERIC DEFAULT 0,
  descripcion TEXT,
  adicionales_incluidos UUID[] DEFAULT '{}',
  activo BOOLEAN DEFAULT true,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lavadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  tipo_pago TEXT,
  pago_porcentaje NUMERIC DEFAULT 0,
  pago_sueldo_base NUMERIC DEFAULT 0,
  pago_por_lavada NUMERIC DEFAULT 0,
  pago_por_adicional NUMERIC DEFAULT 0,
  pago_porcentaje_lavada NUMERIC DEFAULT 0,
  pago_adicional_fijo NUMERIC DEFAULT 0,
  pago_adicionales_detalle JSONB,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metodos_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servicios_adicionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio NUMERIC DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lavadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  placa TEXT,
  tipo_lavado_id UUID REFERENCES tipos_lavado(id) ON DELETE SET NULL,
  tipo_membresia_id UUID REFERENCES tipos_membresia(id) ON DELETE SET NULL,
  lavador_id UUID REFERENCES lavadores(id) ON DELETE SET NULL,
  metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE SET NULL,
  valor NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'EN ESPERA',
  fecha TIMESTAMPTZ DEFAULT now(),
  notas TEXT,
  adicionales JSONB DEFAULT '[]',
  pagos JSONB DEFAULT '[]',
  cera_restaurador BOOLEAN DEFAULT false,
  kit_completo BOOLEAN DEFAULT false,
  hora_inicio_lavado TIMESTAMPTZ,
  tiempo_lavado INTEGER,
  tiempo_espera_inicio TIMESTAMPTZ,
  duracion_espera INTEGER,
  tiempo_lavado_inicio TIMESTAMPTZ,
  duracion_lavado INTEGER,
  tiempo_terminado_inicio TIMESTAMPTZ,
  duracion_terminado INTEGER,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  categoria TEXT,
  descripcion TEXT,
  valor NUMERIC DEFAULT 0,
  placa_o_persona TEXT,
  fecha DATE DEFAULT CURRENT_DATE,
  metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE SET NULL,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  precio NUMERIC DEFAULT 0,
  cantidad INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  frecuencia TEXT DEFAULT 'DIARIA',
  dias_semana INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  activo BOOLEAN DEFAULT true,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tareas_completadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  lavador_id UUID REFERENCES lavadores(id) ON DELETE SET NULL,
  completada BOOLEAN DEFAULT true,
  hora_completada TIMESTAMPTZ,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pago_trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lavador_id UUID NOT NULL REFERENCES lavadores(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  fecha_desde DATE,
  fecha_hasta DATE,
  lavadas_cantidad INTEGER DEFAULT 0,
  kit_cantidad INTEGER DEFAULT 0,
  cera_cantidad INTEGER DEFAULT 0,
  adicionales_cantidad INTEGER DEFAULT 0,
  basico NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  descuentos NUMERIC DEFAULT 0,
  descuentos_detalle JSONB DEFAULT '[]',
  total_pagar NUMERIC DEFAULT 0,
  detalle JSONB,
  metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE SET NULL,
  anulado BOOLEAN DEFAULT false,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT,
  telefono TEXT,
  nombre_cliente TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  origen TEXT DEFAULT 'manual',
  notas TEXT,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla TEXT,
  accion TEXT,
  registro_id TEXT,
  antes JSONB,
  despues JSONB,
  descripcion TEXT,
  usuario_email TEXT,
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos_suscripcion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  wompi_transaction_id TEXT UNIQUE,
  wompi_reference TEXT NOT NULL,
  monto INTEGER NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'COP',
  estado TEXT NOT NULL DEFAULT 'PENDING',
  periodo TEXT,
  datos_wompi JSONB,
  periodo_desde DATE,
  periodo_hasta DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_negocio ON user_profiles(negocio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_negocio ON clientes(negocio_id);
CREATE INDEX IF NOT EXISTS idx_clientes_placa ON clientes(placa);
CREATE INDEX IF NOT EXISTS idx_lavadas_negocio ON lavadas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_lavadas_fecha ON lavadas(fecha);
CREATE INDEX IF NOT EXISTS idx_lavadas_cliente ON lavadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_lavadas_lavador ON lavadas(lavador_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_negocio ON transacciones(negocio_id);
CREATE INDEX IF NOT EXISTS idx_transacciones_fecha ON transacciones(fecha);
CREATE INDEX IF NOT EXISTS idx_productos_negocio ON productos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_tareas_negocio ON tareas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_tareas_completadas_negocio ON tareas_completadas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_tareas_completadas_fecha ON tareas_completadas(fecha);
CREATE INDEX IF NOT EXISTS idx_pago_trabajadores_negocio ON pago_trabajadores(negocio_id);
CREATE INDEX IF NOT EXISTS idx_reservas_negocio ON reservas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_audit_log_negocio ON audit_log(negocio_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_negocio ON pagos_suscripcion(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_referencia ON pagos_suscripcion(wompi_reference);

-- Unique constraint for placa per negocio
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_placa_negocio ON clientes(placa, negocio_id);

-- ============================================
-- ALTER TABLE — add columns missing from initial migration
-- (safe to re-run: uses IF NOT EXISTS / exception handling)
-- ============================================
DO $$ BEGIN
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cashback_acumulado NUMERIC DEFAULT 0;
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  ALTER TABLE lavadores ADD COLUMN IF NOT EXISTS telefono TEXT;
  ALTER TABLE lavadas ADD COLUMN IF NOT EXISTS cera_restaurador BOOLEAN DEFAULT false;
  ALTER TABLE lavadas ADD COLUMN IF NOT EXISTS kit_completo BOOLEAN DEFAULT false;
  ALTER TABLE lavadas ADD COLUMN IF NOT EXISTS hora_inicio_lavado TIMESTAMPTZ;
  ALTER TABLE lavadas ADD COLUMN IF NOT EXISTS tiempo_lavado INTEGER;
  ALTER TABLE lavadas ADD COLUMN IF NOT EXISTS tipo_membresia_id UUID REFERENCES tipos_membresia(id) ON DELETE SET NULL;
  ALTER TABLE pago_trabajadores ADD COLUMN IF NOT EXISTS valor_pagado NUMERIC DEFAULT 0;
  ALTER TABLE negocios ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT false;
  ALTER TABLE negocios ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
  ALTER TABLE negocios ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
  ALTER TABLE negocios ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
  ALTER TABLE negocios ADD COLUMN IF NOT EXISTS subscription_period TEXT;
END $$;

-- Mark existing negocios as already configured so they skip the wizard
UPDATE negocios SET setup_complete = true WHERE setup_complete IS NULL OR setup_complete = false;

-- Negocios existentes: plan PRO activo por 1 año (grandfathered)
UPDATE negocios
SET plan = 'pro',
    trial_ends_at = created_at,
    subscription_expires_at = now() + INTERVAL '365 days'
WHERE trial_ends_at IS NULL;
