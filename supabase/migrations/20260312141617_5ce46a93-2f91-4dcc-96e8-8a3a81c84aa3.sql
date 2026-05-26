
ALTER TABLE public.weekly_todos
  ADD COLUMN has_deliverable boolean NOT NULL DEFAULT false,
  ADD COLUMN deliverable_linked_to_project boolean NOT NULL DEFAULT false,
  ADD COLUMN deliverable_project_id text DEFAULT NULL,
  ADD COLUMN deliverable_name text DEFAULT '';
