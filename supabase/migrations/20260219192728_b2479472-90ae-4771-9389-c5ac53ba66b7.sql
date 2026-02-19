
-- Fix all RLS policies: drop restrictive and recreate as permissive

-- movements
DROP POLICY IF EXISTS "Authenticated users can view all movements" ON public.movements;
DROP POLICY IF EXISTS "Authenticated users can insert movements" ON public.movements;
DROP POLICY IF EXISTS "Users can update own movements or admin updates all" ON public.movements;
DROP POLICY IF EXISTS "Users can delete own movements or admin deletes all" ON public.movements;

CREATE POLICY "Authenticated users can view all movements"
  ON public.movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert movements"
  ON public.movements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own movements or admin updates all"
  ON public.movements FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin())
  WITH CHECK ((user_id = auth.uid()) OR public.is_admin());

CREATE POLICY "Users can delete own movements or admin deletes all"
  ON public.movements FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin());

-- products
DROP POLICY IF EXISTS "All authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin can update products" ON public.products;
DROP POLICY IF EXISTS "Admin can delete products" ON public.products;

CREATE POLICY "All authenticated users can view products"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert products"
  ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete products"
  ON public.products FOR DELETE TO authenticated USING (public.is_admin());

-- profiles
DROP POLICY IF EXISTS "Users can view own profile or admin views all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or admin views all"
  ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()) OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR (id = auth.uid()));

CREATE POLICY "Admin can delete profiles"
  ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- user_roles
DROP POLICY IF EXISTS "Admin can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Admin can manage user roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
