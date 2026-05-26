
-- Server-side validation trigger for time entries
-- Prevents manipulation of hours, dates, and business rules via API

CREATE OR REPLACE FUNCTION public.validate_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _data jsonb;
  _date text;
  _start_time text;
  _end_time text;
  _hours_worked numeric;
  _entry_date date;
  _now timestamp with time zone := now();
  _today date := current_date;
  _start_minutes int;
  _end_minutes int;
  _calculated_hours numeric;
  _day_of_week int;
  _is_admin boolean;
BEGIN
  _data := NEW.data;
  
  -- Admins bypass all validation
  _is_admin := public.has_role(NEW.user_id, 'admin');
  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- 1. Ensure user_id matches the authenticated user (no impersonation)
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez saisir du temps que pour votre propre compte.';
  END IF;

  -- 2. Extract and validate required fields
  _date := _data->>'date';
  _start_time := _data->>'startTime';
  _end_time := _data->>'endTime';
  _hours_worked := (_data->>'hoursWorked')::numeric;

  IF _date IS NULL OR _start_time IS NULL OR _end_time IS NULL THEN
    RAISE EXCEPTION 'Les champs date, startTime et endTime sont obligatoires.';
  END IF;

  _entry_date := _date::date;

  -- 3. No future dates
  IF _entry_date > _today THEN
    RAISE EXCEPTION 'Impossible de saisir du temps pour une date future.';
  END IF;

  -- 4. Business days only (Mon-Fri) unless 24/7 mode
  _day_of_week := EXTRACT(DOW FROM _entry_date)::int; -- 0=Sun, 6=Sat
  -- Check if user has 24/7 exemption
  IF NOT EXISTS (SELECT 1 FROM time_entry_exemptions WHERE user_id = NEW.user_id) THEN
    IF _day_of_week = 0 OR _day_of_week = 6 THEN
      RAISE EXCEPTION 'La saisie n''est possible que pour les jours ouvrés (lundi-vendredi).';
    END IF;
  END IF;

  -- 5. Validate time range (start < end)
  _start_minutes := (split_part(_start_time, ':', 1)::int * 60) + split_part(_start_time, ':', 2)::int;
  _end_minutes := (split_part(_end_time, ':', 1)::int * 60) + split_part(_end_time, ':', 2)::int;
  
  IF _end_minutes <= _start_minutes THEN
    RAISE EXCEPTION 'L''heure de fin doit être postérieure à l''heure de début.';
  END IF;

  -- 6. Validate hoursWorked matches start/end times (tolerance of 0.1h)
  _calculated_hours := (_end_minutes - _start_minutes)::numeric / 60.0;
  IF _hours_worked IS NOT NULL AND ABS(_hours_worked - _calculated_hours) > 0.1 THEN
    -- Override with correct calculation to prevent tampering
    NEW.data := jsonb_set(NEW.data, '{hoursWorked}', to_jsonb(ROUND(_calculated_hours, 2)));
  END IF;

  -- 7. Max hours per entry: 12h (reasonable limit)
  IF _calculated_hours > 12 THEN
    RAISE EXCEPTION 'Une saisie ne peut pas dépasser 12 heures.';
  END IF;

  -- 8. Prevent modification of validated entries (non-admin)
  IF TG_OP = 'UPDATE' AND OLD.validated = true THEN
    RAISE EXCEPTION 'Les saisies validées ne peuvent être modifiées que par l''administrateur.';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to app_time_entries
CREATE TRIGGER trg_validate_time_entry
  BEFORE INSERT OR UPDATE ON public.app_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_time_entry();
