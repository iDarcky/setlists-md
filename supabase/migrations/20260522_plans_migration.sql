-- 1. Add new columns to profiles
ALTER TABLE public.profiles ADD COLUMN is_pro boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN subscription_tier text DEFAULT 'free';

-- 2. Add billing_plan to teams
ALTER TABLE public.teams ADD COLUMN billing_plan text DEFAULT 'free';

-- 3. Migrate existing data
UPDATE public.profiles 
SET 
  subscription_tier = CASE WHEN plan IN ('sync', 'team', 'church') THEN plan ELSE 'free' END,
  is_pro = CASE WHEN plan != 'free' THEN true ELSE false END;

UPDATE public.teams t
SET billing_plan = p.plan
FROM public.profiles p
WHERE t.owner_id = p.id AND p.plan IN ('team', 'church');

-- 4. Drop legacy column
ALTER TABLE public.profiles DROP COLUMN plan;
