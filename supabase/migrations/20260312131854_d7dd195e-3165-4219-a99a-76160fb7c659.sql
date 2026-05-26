
CREATE TABLE public.weekly_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own todos" ON public.weekly_todos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own todos" ON public.weekly_todos
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own todos" ON public.weekly_todos
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own todos" ON public.weekly_todos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all todos" ON public.weekly_todos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
