-- Desactivar stock mínimo en todos los productos existentes y cambiar el default a false
UPDATE public.products SET stock_minimo_activo = false;
ALTER TABLE public.products ALTER COLUMN stock_minimo_activo SET DEFAULT false;
