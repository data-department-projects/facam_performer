
-- Allow managers to view subordinate todos
CREATE POLICY "Managers can view subordinate todos" ON public.weekly_todos
  FOR SELECT TO authenticated USING (public.is_manager_of(user_id));

-- Allow managers to insert todos for subordinates
CREATE POLICY "Managers can insert subordinate todos" ON public.weekly_todos
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_of(user_id));

-- Allow managers to delete subordinate todos
CREATE POLICY "Managers can delete subordinate todos" ON public.weekly_todos
  FOR DELETE TO authenticated USING (public.is_manager_of(user_id));

-- Allow managers to update subordinate todos
CREATE POLICY "Managers can update subordinate todos" ON public.weekly_todos
  FOR UPDATE TO authenticated USING (public.is_manager_of(user_id));

-- Allow admins to manage all todos (insert, update, delete)
CREATE POLICY "Admins can manage all todos" ON public.weekly_todos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
