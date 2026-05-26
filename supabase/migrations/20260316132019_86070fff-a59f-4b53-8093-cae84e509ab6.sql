-- Backfill existing weekly planner tasks already referenced by saved time entries
UPDATE public.weekly_todos wt
SET completed = true,
    updated_at = now()
FROM public.app_time_entries e
WHERE e.user_id = wt.user_id
  AND COALESCE(e.data->>'taskId', '') <> ''
  AND (e.data->>'taskId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND wt.id = (e.data->>'taskId')::uuid
  AND wt.completed IS DISTINCT FROM true;

-- Ensure future time entries automatically mark the linked weekly task as completed
CREATE OR REPLACE FUNCTION public.sync_weekly_todo_completion_from_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task_id uuid;
BEGIN
  IF COALESCE(NEW.data->>'taskId', '') = '' THEN
    RETURN NEW;
  END IF;

  IF (NEW.data->>'taskId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NEW;
  END IF;

  _task_id := (NEW.data->>'taskId')::uuid;

  UPDATE public.weekly_todos
  SET completed = true,
      updated_at = now()
  WHERE id = _task_id
    AND user_id = NEW.user_id
    AND completed IS DISTINCT FROM true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_weekly_todo_completion_on_time_entry ON public.app_time_entries;

CREATE TRIGGER sync_weekly_todo_completion_on_time_entry
AFTER INSERT OR UPDATE OF data ON public.app_time_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_weekly_todo_completion_from_time_entry();