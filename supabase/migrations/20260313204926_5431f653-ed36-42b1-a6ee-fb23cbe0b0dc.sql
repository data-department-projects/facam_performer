
ALTER TABLE public.operational_meetings
  ADD COLUMN time_start text,
  ADD COLUMN time_end text,
  ADD COLUMN connection_link text;

-- Migrate existing 'time' data to 'time_start'
UPDATE public.operational_meetings SET time_start = time WHERE time IS NOT NULL;

ALTER TABLE public.operational_meetings DROP COLUMN time;
