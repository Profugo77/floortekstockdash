
-- ============================================================
-- FloorTek Stock — Complete Database Schema
-- ============================================================

-- 1. Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table (separate, as required)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otros',
  unidad TEXT NOT NULL DEFAULT 'm2',
  stock_actual NUMERIC NOT NULL DEFAULT 0,
  stock_minimo NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_nombre_unique UNIQUE (nombre),
  CONSTRAINT products_stock_actual_non_negative CHECK (stock_actual >= 0)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5. Movements table
CREATE TABLE public.movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  observaciones TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ============================================================
-- RLS POLICIES — profiles
-- ============================================================

CREATE POLICY "Users can view own profile or admin views all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR id = auth.uid());

CREATE POLICY "Admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES — user_roles
-- ============================================================

CREATE POLICY "Admin can manage user roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES — products
-- ============================================================

CREATE POLICY "All authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RLS POLICIES — movements
-- ============================================================

CREATE POLICY "Authenticated users can view all movements"
  ON public.movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert movements"
  ON public.movements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own movements or admin updates all"
  ON public.movements FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete own movements or admin deletes all"
  ON public.movements FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: update stock_actual on movement insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_movement_to_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.products
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = NEW.product_id;
  ELSIF NEW.tipo = 'salida' THEN
    -- Check stock won't go negative
    IF (SELECT stock_actual FROM public.products WHERE id = NEW.product_id) < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para realizar la salida';
    END IF;
    UPDATE public.products
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_movement_insert
  AFTER INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_movement_to_stock();
