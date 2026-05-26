
-- Expense types created by project leads
CREATE TABLE public.project_expense_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Expenses entries
CREATE TABLE public.project_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  expense_type_id UUID REFERENCES public.project_expense_types(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense types
CREATE POLICY "Authenticated users can view expense types" ON public.project_expense_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert expense types" ON public.project_expense_types FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can delete expense types" ON public.project_expense_types FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for expenses
CREATE POLICY "Authenticated users can view expenses" ON public.project_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert expenses" ON public.project_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update expenses" ON public.project_expenses FOR UPDATE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Creator or admin can delete expenses" ON public.project_expenses FOR DELETE TO authenticated USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
