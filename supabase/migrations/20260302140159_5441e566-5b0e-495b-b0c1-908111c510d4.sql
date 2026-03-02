-- Fix duplicate stock application on movement insert
-- There are currently two AFTER INSERT triggers calling apply_movement_to_stock(),
-- which applies each movement twice.

DROP TRIGGER IF EXISTS on_movement_insert ON public.movements;
DROP TRIGGER IF EXISTS trigger_apply_movement ON public.movements;

CREATE TRIGGER trigger_apply_movement
AFTER INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_movement_to_stock();