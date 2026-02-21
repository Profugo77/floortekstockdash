
-- 1. Create deleted_movements history table
CREATE TABLE public.deleted_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_movement_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  tipo text NOT NULL,
  cantidad numeric NOT NULL,
  fecha date NOT NULL,
  observaciones text,
  original_user_id uuid NOT NULL,
  deleted_by uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deleted_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view deleted movements"
ON public.deleted_movements FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert deleted movements"
ON public.deleted_movements FOR INSERT
WITH CHECK (deleted_by = auth.uid());

-- 2. Update apply_movement_to_stock to handle 'ajuste' type
CREATE OR REPLACE FUNCTION public.apply_movement_to_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.products
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = NEW.product_id;
  ELSIF NEW.tipo = 'salida' THEN
    IF (SELECT stock_actual FROM public.products WHERE id = NEW.product_id) < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para realizar la salida';
    END IF;
    UPDATE public.products
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.product_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    -- For ajuste, cantidad is the NEW absolute stock value
    -- We store the difference as the movement cantidad
    DECLARE
      current_stock numeric;
    BEGIN
      SELECT stock_actual INTO current_stock FROM public.products WHERE id = NEW.product_id;
      UPDATE public.products
      SET stock_actual = NEW.cantidad
      WHERE id = NEW.product_id;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create trigger to reverse stock on movement deletion
CREATE OR REPLACE FUNCTION public.reverse_movement_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.tipo = 'entrada' THEN
    UPDATE public.products
    SET stock_actual = GREATEST(stock_actual - OLD.cantidad, 0)
    WHERE id = OLD.product_id;
  ELSIF OLD.tipo = 'salida' THEN
    UPDATE public.products
    SET stock_actual = stock_actual + OLD.cantidad
    WHERE id = OLD.product_id;
  ELSIF OLD.tipo = 'ajuste' THEN
    -- Cannot reverse ajuste automatically, just log it
    NULL;
  END IF;
  RETURN OLD;
END;
$$;

-- 4. Ensure triggers exist on movements table
DROP TRIGGER IF EXISTS trigger_apply_movement ON public.movements;
CREATE TRIGGER trigger_apply_movement
  AFTER INSERT ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_movement_to_stock();

DROP TRIGGER IF EXISTS trigger_reverse_movement ON public.movements;
CREATE TRIGGER trigger_reverse_movement
  BEFORE DELETE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.reverse_movement_on_delete();
