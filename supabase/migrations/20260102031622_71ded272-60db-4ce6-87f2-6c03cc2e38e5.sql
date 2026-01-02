-- =============================================
-- COMMUNICATION HUB SCHEMA
-- Enterprise-grade real-time messaging system
-- =============================================

-- Create enum for thread context
CREATE TYPE thread_context_type AS ENUM ('general', 'compliance', 'onboarding', 'renewals');

-- Create enum for participant type
CREATE TYPE participant_type AS ENUM ('buyer', 'supplier');

-- Create enum for thread status
CREATE TYPE thread_status AS ENUM ('active', 'archived');

-- =============================================
-- TABLE: communication_threads
-- Core conversation threads between buyer and supplier
-- =============================================
CREATE TABLE public.communication_threads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    buyer_branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
    supplier_branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
    thread_context thread_context_type NOT NULL DEFAULT 'general',
    thread_title TEXT,
    status thread_status NOT NULL DEFAULT 'active',
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(buyer_id, supplier_id, buyer_branch_id, supplier_branch_id, thread_context)
);

-- =============================================
-- TABLE: thread_participants
-- Track who is part of each conversation
-- =============================================
CREATE TABLE public.thread_participants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_type participant_type NOT NULL,
    company_id UUID NOT NULL,
    branch_id UUID REFERENCES public.company_branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_read_at TIMESTAMPTZ,
    unread_count INTEGER NOT NULL DEFAULT 0,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ,
    UNIQUE(thread_id, profile_id)
);

-- =============================================
-- TABLE: communication_messages
-- Individual messages within threads
-- =============================================
CREATE TABLE public.communication_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_type participant_type NOT NULL,
    sender_company_id UUID NOT NULL,
    content TEXT NOT NULL,
    mentions JSONB DEFAULT '[]'::jsonb,
    document_tags JSONB DEFAULT '[]'::jsonb,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_system_message BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABLE: message_attachments
-- Files attached to messages
-- =============================================
CREATE TABLE public.message_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABLE: message_read_receipts
-- Track who has read each message
-- =============================================
CREATE TABLE public.message_read_receipts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(message_id, profile_id)
);

-- =============================================
-- TABLE: communication_audit_logs
-- Full audit trail for compliance
-- =============================================
CREATE TABLE public.communication_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID REFERENCES public.communication_threads(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.communication_messages(id) ON DELETE SET NULL,
    attachment_id UUID REFERENCES public.message_attachments(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_comm_threads_buyer_id ON public.communication_threads(buyer_id);
CREATE INDEX idx_comm_threads_supplier_id ON public.communication_threads(supplier_id);
CREATE INDEX idx_comm_threads_last_message ON public.communication_threads(last_message_at DESC);
CREATE INDEX idx_comm_threads_status ON public.communication_threads(status);

CREATE INDEX idx_comm_participants_thread ON public.thread_participants(thread_id);
CREATE INDEX idx_comm_participants_profile ON public.thread_participants(profile_id);
CREATE INDEX idx_comm_participants_company ON public.thread_participants(company_id);
CREATE INDEX idx_comm_participants_unread ON public.thread_participants(profile_id, unread_count) WHERE unread_count > 0;

CREATE INDEX idx_comm_messages_thread ON public.communication_messages(thread_id);
CREATE INDEX idx_comm_messages_sender ON public.communication_messages(sender_id);
CREATE INDEX idx_comm_messages_created ON public.communication_messages(created_at DESC);
CREATE INDEX idx_comm_messages_not_deleted ON public.communication_messages(thread_id, created_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_comm_attachments_message ON public.message_attachments(message_id);
CREATE INDEX idx_comm_read_receipts_message ON public.message_read_receipts(message_id);
CREATE INDEX idx_comm_read_receipts_profile ON public.message_read_receipts(profile_id);

CREATE INDEX idx_comm_audit_thread ON public.communication_audit_logs(thread_id);
CREATE INDEX idx_comm_audit_user ON public.communication_audit_logs(user_id);
CREATE INDEX idx_comm_audit_action ON public.communication_audit_logs(action_type);
CREATE INDEX idx_comm_audit_created ON public.communication_audit_logs(created_at DESC);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: communication_threads
-- =============================================
CREATE POLICY "Users can view threads they participate in"
ON public.communication_threads FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Users can create threads for their company"
ON public.communication_threads FOR INSERT
WITH CHECK (
    -- Buyer creating thread
    (EXISTS (
        SELECT 1 FROM public.buyers b
        JOIN public.company_users cu ON cu.company_id = b.id AND cu.company_type = 'buyer'
        WHERE b.id = buyer_id AND cu.profile_id = auth.uid()
    ))
    OR
    -- Supplier creating thread
    (EXISTS (
        SELECT 1 FROM public.suppliers s
        JOIN public.company_users cu ON cu.company_id = s.id AND cu.company_type = 'supplier'
        WHERE s.id = supplier_id AND cu.profile_id = auth.uid()
    ))
);

CREATE POLICY "Participants can update thread"
ON public.communication_threads FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

-- =============================================
-- RLS POLICIES: thread_participants
-- =============================================
CREATE POLICY "Users can view participants of their threads"
ON public.thread_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = thread_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Users can join threads for their company"
ON public.thread_participants FOR INSERT
WITH CHECK (
    profile_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = company_id
        AND cu.profile_id = auth.uid()
        AND cu.role IN ('company_admin', 'admin')
    )
);

CREATE POLICY "Users can update their own participation"
ON public.thread_participants FOR UPDATE
USING (
    profile_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.company_users cu
        WHERE cu.company_id = company_id
        AND cu.profile_id = auth.uid()
        AND cu.role IN ('company_admin', 'admin')
    )
);

-- =============================================
-- RLS POLICIES: communication_messages
-- =============================================
CREATE POLICY "Participants can view messages in their threads"
ON public.communication_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = thread_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Participants can send messages to their threads"
ON public.communication_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND
    EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = thread_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Senders can edit their own messages"
ON public.communication_messages FOR UPDATE
USING (sender_id = auth.uid() AND deleted_at IS NULL);

-- =============================================
-- RLS POLICIES: message_attachments
-- =============================================
CREATE POLICY "Participants can view attachments in their threads"
ON public.message_attachments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.communication_messages m
        JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
        WHERE m.id = message_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Participants can upload attachments"
ON public.message_attachments FOR INSERT
WITH CHECK (
    uploaded_by = auth.uid()
    AND
    EXISTS (
        SELECT 1 FROM public.communication_messages m
        JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
        WHERE m.id = message_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Anyone can update download count"
ON public.message_attachments FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.communication_messages m
        JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
        WHERE m.id = message_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

-- =============================================
-- RLS POLICIES: message_read_receipts
-- =============================================
CREATE POLICY "Users can view read receipts for their threads"
ON public.message_read_receipts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.communication_messages m
        JOIN public.thread_participants tp ON tp.thread_id = m.thread_id
        WHERE m.id = message_id
        AND tp.profile_id = auth.uid()
        AND tp.is_active = true
    )
);

CREATE POLICY "Users can create their own read receipts"
ON public.message_read_receipts FOR INSERT
WITH CHECK (profile_id = auth.uid());

-- =============================================
-- RLS POLICIES: communication_audit_logs
-- =============================================
CREATE POLICY "Admins can view audit logs for their threads"
ON public.communication_audit_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.thread_participants tp
        JOIN public.company_users cu ON cu.profile_id = tp.profile_id AND cu.company_id = tp.company_id
        WHERE tp.thread_id = thread_id
        AND tp.profile_id = auth.uid()
        AND cu.role IN ('company_admin', 'admin')
    )
);

CREATE POLICY "System can insert audit logs"
ON public.communication_audit_logs FOR INSERT
WITH CHECK (true);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update thread's last_message_at when new message is sent
CREATE OR REPLACE FUNCTION update_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.communication_threads
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        updated_at = now()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_thread_last_message
AFTER INSERT ON public.communication_messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_last_message();

-- Increment unread count for other participants when new message
CREATE OR REPLACE FUNCTION increment_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.thread_participants
    SET unread_count = unread_count + 1
    WHERE thread_id = NEW.thread_id
    AND profile_id != NEW.sender_id
    AND is_active = true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_unread
AFTER INSERT ON public.communication_messages
FOR EACH ROW
EXECUTE FUNCTION increment_unread_counts();

-- Reset unread count when user reads messages
CREATE OR REPLACE FUNCTION reset_unread_on_read()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.thread_participants tp
    SET 
        unread_count = 0,
        last_read_at = now()
    FROM public.communication_messages m
    WHERE m.id = NEW.message_id
    AND tp.thread_id = m.thread_id
    AND tp.profile_id = NEW.profile_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_reset_unread
AFTER INSERT ON public.message_read_receipts
FOR EACH ROW
EXECUTE FUNCTION reset_unread_on_read();

-- =============================================
-- STORAGE BUCKET for attachments
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'communication-attachments',
    'communication-attachments',
    false,
    52428800, -- 50MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain', 'text/csv']
);

-- Storage policies
CREATE POLICY "Authenticated users can upload comm attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'communication-attachments');

CREATE POLICY "Users can view comm attachments they have access to"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'communication-attachments');

CREATE POLICY "Users can delete their own comm attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'communication-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER TABLE public.communication_messages REPLICA IDENTITY FULL;
ALTER TABLE public.thread_participants REPLICA IDENTITY FULL;
ALTER TABLE public.message_read_receipts REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;