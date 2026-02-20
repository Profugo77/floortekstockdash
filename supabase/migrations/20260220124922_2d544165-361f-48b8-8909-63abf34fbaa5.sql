
-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update existing users (admin user floortek.ar@gmail.com should be approved)
UPDATE public.profiles SET status = 'approved' WHERE email = 'floortek.ar@gmail.com';

-- Also approve any existing users that already have a role assigned (they were manually added before this feature)
UPDATE public.profiles SET status = 'approved' 
WHERE id IN (SELECT user_id FROM public.user_roles);

-- Update handle_new_user trigger to set status = 'pending' for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pending'
  );
  RETURN NEW;
END;
$function$;
