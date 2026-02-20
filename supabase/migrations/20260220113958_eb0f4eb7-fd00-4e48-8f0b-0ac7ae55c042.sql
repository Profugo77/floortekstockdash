ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS stock_minimo_activo boolean NOT NULL DEFAULT true;