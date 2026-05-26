
-- Create modification request status type
CREATE TYPE public.modification_status AS ENUM ('pending', 'approved', 'rejected');

-- Table for modification requests requiring DG approval
CREATE TABLE public.modification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL, -- 'project' or 'milestone'
  entity_id TEXT NOT NULL, -- project id or milestone id
  project_id TEXT NOT NULL, -- always the parent project id
  field_name TEXT NOT NULL, -- which field is being modified
  old_value TEXT,
  new_value TEXT,
  explanation TEXT NOT NULL DEFAULT '',
  status modification_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.modification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own modification requests"
ON public.modification_requests FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all modification requests"
ON public.modification_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can create requests
CREATE POLICY "Users can create modification requests"
ON public.modification_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can manage modification requests"
ON public.modification_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));
