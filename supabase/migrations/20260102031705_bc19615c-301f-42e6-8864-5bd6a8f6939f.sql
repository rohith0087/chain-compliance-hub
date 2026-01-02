-- Fix search_path for communication hub trigger functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;