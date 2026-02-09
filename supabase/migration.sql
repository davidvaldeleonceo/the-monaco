-- =====================================================
-- Monaco Multi-Tenant SaaS Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Tabla negocios
CREATE TABLE public.negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla user_profiles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'admin',
  nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Funcion helper para RLS
CREATE OR REPLACE FUNCTION public.get_my_negocio_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT negocio_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 4. Agregar negocio_id a las 11 tablas existentes
ALTER TABLE public.clientes ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.lavadas ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.tipos_lavado ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.tipos_membresia ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.lavadores ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.metodos_pago ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.servicios_adicionales ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.transacciones ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.tareas ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.tareas_completadas ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);
ALTER TABLE public.pago_trabajadores ADD COLUMN negocio_id UUID REFERENCES public.negocios(id);

-- 5. Indices
CREATE INDEX idx_clientes_negocio ON public.clientes(negocio_id);
CREATE INDEX idx_lavadas_negocio ON public.lavadas(negocio_id);
CREATE INDEX idx_tipos_lavado_negocio ON public.tipos_lavado(negocio_id);
CREATE INDEX idx_tipos_membresia_negocio ON public.tipos_membresia(negocio_id);
CREATE INDEX idx_lavadores_negocio ON public.lavadores(negocio_id);
CREATE INDEX idx_metodos_pago_negocio ON public.metodos_pago(negocio_id);
CREATE INDEX idx_servicios_adicionales_negocio ON public.servicios_adicionales(negocio_id);
CREATE INDEX idx_transacciones_negocio ON public.transacciones(negocio_id);
CREATE INDEX idx_tareas_negocio ON public.tareas(negocio_id);
CREATE INDEX idx_tareas_completadas_negocio ON public.tareas_completadas(negocio_id);
CREATE INDEX idx_pago_trabajadores_negocio ON public.pago_trabajadores(negocio_id);
CREATE INDEX idx_user_profiles_negocio ON public.user_profiles(negocio_id);

-- 6. Habilitar RLS en TODAS las tablas
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lavadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_lavado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_membresia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lavadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_adicionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_completadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pago_trabajadores ENABLE ROW LEVEL SECURITY;

-- 7. Policies para negocios y user_profiles
CREATE POLICY "Users can view own negocio" ON public.negocios FOR SELECT USING (id = public.get_my_negocio_id());
CREATE POLICY "Users can update own negocio" ON public.negocios FOR UPDATE USING (id = public.get_my_negocio_id());

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (negocio_id = public.get_my_negocio_id());
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (id = auth.uid());

-- 8. Policies automaticas para las 11 tablas de datos
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'clientes','lavadas','tipos_lavado','tipos_membresia','lavadores',
    'metodos_pago','servicios_adicionales','transacciones','tareas',
    'tareas_completadas','pago_trabajadores'
  ]) LOOP
    EXECUTE format('CREATE POLICY "Tenant SELECT on %1$s" ON public.%1$s FOR SELECT USING (negocio_id = public.get_my_negocio_id())', tbl);
    EXECUTE format('CREATE POLICY "Tenant INSERT on %1$s" ON public.%1$s FOR INSERT WITH CHECK (negocio_id = public.get_my_negocio_id())', tbl);
    EXECUTE format('CREATE POLICY "Tenant UPDATE on %1$s" ON public.%1$s FOR UPDATE USING (negocio_id = public.get_my_negocio_id())', tbl);
    EXECUTE format('CREATE POLICY "Tenant DELETE on %1$s" ON public.%1$s FOR DELETE USING (negocio_id = public.get_my_negocio_id())', tbl);
  END LOOP;
END $$;

-- 9. Funcion seed para onboarding de nuevos negocios
CREATE OR REPLACE FUNCTION public.seed_negocio_defaults(p_negocio_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.tipos_membresia (nombre, precio, descuento, duracion_dias, activo, negocio_id) VALUES
    ('SIN MEMBRESIA', 0, 0, 0, true, p_negocio_id),
    ('MEMBRESIA BASICA', 80000, 0.3, 30, true, p_negocio_id),
    ('MEMBRESIA PREMIUM', 120000, 0.5, 30, true, p_negocio_id);
  INSERT INTO public.tipos_lavado (nombre, precio, activo, negocio_id) VALUES
    ('SIN MEMBRESIA', 15000, true, p_negocio_id),
    ('MEMBRESIA', 0, true, p_negocio_id);
  INSERT INTO public.metodos_pago (nombre, activo, negocio_id) VALUES
    ('Efectivo', true, p_negocio_id),
    ('Nequi', true, p_negocio_id),
    ('Daviplata', true, p_negocio_id),
    ('Transferencia', true, p_negocio_id);
  INSERT INTO public.servicios_adicionales (nombre, precio, activo, negocio_id) VALUES
    ('Polichada', 10000, true, p_negocio_id),
    ('Silicona', 5000, true, p_negocio_id);
END; $$;

-- 10. Funcion de registro (llamada desde frontend via supabase.rpc)
CREATE OR REPLACE FUNCTION public.register_negocio(
  p_nombre_negocio TEXT, p_nombre_usuario TEXT DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_negocio_id UUID; v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.negocios (nombre, email)
  VALUES (p_nombre_negocio, (SELECT email FROM auth.users WHERE id = v_user_id))
  RETURNING id INTO v_negocio_id;

  INSERT INTO public.user_profiles (id, negocio_id, rol, nombre)
  VALUES (v_user_id, v_negocio_id, 'admin', COALESCE(p_nombre_usuario, p_nombre_negocio));

  PERFORM public.seed_negocio_defaults(v_negocio_id);

  RETURN json_build_object('negocio_id', v_negocio_id, 'user_id', v_user_id);
END; $$;


-- =====================================================
-- MIGRACION DE DATOS EXISTENTES
-- Ejecutar DESPUES del script anterior
-- REEMPLAZAR los valores de EMAIL, AUTH-USER-UUID con los reales
-- =====================================================

-- Crear negocio para Monaco existente
-- INSERT INTO public.negocios (id, nombre, email)
-- VALUES (gen_random_uuid(), 'Monaco Moto Detailing', 'EMAIL-DEL-ADMIN-ACTUAL');
-- -- Anotar el UUID generado

-- Crear user_profile para el usuario existente
-- INSERT INTO public.user_profiles (id, negocio_id, rol, nombre)
-- VALUES ('AUTH-USER-UUID', 'NEGOCIO-UUID', 'admin', 'Administrador');

-- Backfill negocio_id en todas las tablas
-- UPDATE public.clientes SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.lavadas SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.tipos_lavado SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.tipos_membresia SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.lavadores SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.metodos_pago SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.servicios_adicionales SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.transacciones SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.tareas SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.tareas_completadas SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;
-- UPDATE public.pago_trabajadores SET negocio_id = 'NEGOCIO-UUID' WHERE negocio_id IS NULL;

-- Hacer NOT NULL despues del backfill
-- ALTER TABLE public.clientes ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.lavadas ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.tipos_lavado ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.tipos_membresia ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.lavadores ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.metodos_pago ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.servicios_adicionales ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.transacciones ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.tareas ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.tareas_completadas ALTER COLUMN negocio_id SET NOT NULL;
-- ALTER TABLE public.pago_trabajadores ALTER COLUMN negocio_id SET NOT NULL;
