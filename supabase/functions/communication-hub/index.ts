import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, ...params } = await req.json();
    console.log(`[Communication Hub] Action: ${action}, User: ${user.id}`);

    let result;

    switch (action) {
      case 'get_threads':
        result = await getThreads(supabase, user.id, params);
        break;
      case 'get_or_create_thread':
        result = await getOrCreateThread(supabase, user.id, params);
        break;
      case 'get_thread':
        result = await getThread(supabase, user.id, params.threadId);
        break;
      case 'get_messages':
        result = await getMessages(supabase, user.id, params);
        break;
      case 'send_message':
        result = await sendMessage(supabase, user.id, params);
        break;
      case 'edit_message':
        result = await editMessage(supabase, user.id, params);
        break;
      case 'delete_message':
        result = await deleteMessage(supabase, user.id, params);
        break;
      case 'mark_read':
        result = await markRead(supabase, user.id, params);
        break;
      case 'get_taggable_documents':
        result = await getTaggableDocuments(supabase, user.id, params);
        break;
      case 'get_mentionable_users':
        result = await getMentionableUsers(supabase, user.id, params);
        break;
      case 'get_unread_count':
        result = await getUnreadCount(supabase, user.id);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Communication Hub] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Get all threads for user
async function getThreads(supabase: any, userId: string, params: any) {
  const { companyId, companyType, limit = 50, offset = 0 } = params;
  
  // First get participant records for this user
  const { data: participantData, error: participantError } = await supabase
    .from('thread_participants')
    .select('thread_id')
    .eq('profile_id', userId)
    .eq('is_active', true);

  if (participantError) throw participantError;
  
  const threadIds = participantData.map((p: any) => p.thread_id);
  
  if (threadIds.length === 0) {
    return { threads: [], total: 0 };
  }

  // Get threads with participant info
  const { data, error, count } = await supabase
    .from('communication_threads')
    .select(`
      *,
      buyer:buyers(id, company_name, company_logo_url),
      supplier:suppliers(id, company_name, company_logo_url),
      participants:thread_participants(
        id, profile_id, participant_type, unread_count, last_read_at,
        profile:profiles(id, full_name, avatar_url)
      )
    `, { count: 'exact' })
    .in('id', threadIds)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return { threads: data || [], total: count || 0 };
}

// Get or create a thread between buyer and supplier
async function getOrCreateThread(supabase: any, userId: string, params: any) {
  const { buyerId, supplierId, buyerBranchId, supplierBranchId, threadContext = 'general' } = params;

  // Check if thread already exists
  let query = supabase
    .from('communication_threads')
    .select(`
      *,
      buyer:buyers(id, company_name, company_logo_url),
      supplier:suppliers(id, company_name, company_logo_url),
      participants:thread_participants(
        id, profile_id, participant_type, unread_count,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq('buyer_id', buyerId)
    .eq('supplier_id', supplierId)
    .eq('thread_context', threadContext);
    
  if (buyerBranchId) {
    query = query.eq('buyer_branch_id', buyerBranchId);
  } else {
    query = query.is('buyer_branch_id', null);
  }
  
  if (supplierBranchId) {
    query = query.eq('supplier_branch_id', supplierBranchId);
  } else {
    query = query.is('supplier_branch_id', null);
  }

  const { data: existingThread, error: searchError } = await query.maybeSingle();

  if (searchError) throw searchError;

  if (existingThread) {
    // Check if user is already a participant
    const isParticipant = existingThread.participants?.some((p: any) => p.profile_id === userId);
    if (!isParticipant) {
      // Add user as participant
      await addParticipant(supabase, existingThread.id, userId, params.participantType, params.companyId);
    }
    return { thread: existingThread, created: false };
  }

  // Create new thread
  const { data: newThread, error: createError } = await supabase
    .from('communication_threads')
    .insert({
      buyer_id: buyerId,
      supplier_id: supplierId,
      buyer_branch_id: buyerBranchId || null,
      supplier_branch_id: supplierBranchId || null,
      thread_context: threadContext,
      created_by: userId
    })
    .select()
    .single();

  if (createError) throw createError;

  // Add creator as participant
  await addParticipant(supabase, newThread.id, userId, params.participantType, params.companyId);

  // Log audit
  await logAudit(supabase, {
    thread_id: newThread.id,
    user_id: userId,
    action_type: 'thread_created',
    metadata: { buyer_id: buyerId, supplier_id: supplierId }
  });

  // Return with full data
  const { data: fullThread } = await supabase
    .from('communication_threads')
    .select(`
      *,
      buyer:buyers(id, company_name, company_logo_url),
      supplier:suppliers(id, company_name, company_logo_url),
      participants:thread_participants(
        id, profile_id, participant_type, unread_count,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq('id', newThread.id)
    .single();

  return { thread: fullThread, created: true };
}

// Helper to add participant
async function addParticipant(supabase: any, threadId: string, profileId: string, participantType: string, companyId: string) {
  const { error } = await supabase
    .from('thread_participants')
    .insert({
      thread_id: threadId,
      profile_id: profileId,
      participant_type: participantType,
      company_id: companyId,
      is_active: true
    });
  
  if (error && error.code !== '23505') { // Ignore unique constraint violation
    throw error;
  }
}

// Get single thread
async function getThread(supabase: any, userId: string, threadId: string) {
  const { data, error } = await supabase
    .from('communication_threads')
    .select(`
      *,
      buyer:buyers(id, company_name, company_logo_url),
      supplier:suppliers(id, company_name, company_logo_url),
      participants:thread_participants(
        id, profile_id, participant_type, unread_count, last_read_at,
        profile:profiles(id, full_name, avatar_url)
      )
    `)
    .eq('id', threadId)
    .single();

  if (error) throw error;
  return { thread: data };
}

// Get messages for a thread
async function getMessages(supabase: any, userId: string, params: any) {
  const { threadId, limit = 50, before } = params;

  let query = supabase
    .from('communication_messages')
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url),
      attachments:message_attachments(*)
    `)
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  return { messages: (data || []).reverse() };
}

// Send a message
async function sendMessage(supabase: any, userId: string, params: any) {
  const { threadId, content, mentions = [], documentTags = [], senderType, senderCompanyId } = params;

  // Create message
  const { data: message, error: msgError } = await supabase
    .from('communication_messages')
    .insert({
      thread_id: threadId,
      sender_id: userId,
      sender_type: senderType,
      sender_company_id: senderCompanyId,
      content,
      mentions,
      document_tags: documentTags
    })
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url)
    `)
    .single();

  if (msgError) throw msgError;

  // Log audit
  await logAudit(supabase, {
    thread_id: threadId,
    message_id: message.id,
    user_id: userId,
    action_type: 'message_sent',
    metadata: { 
      has_mentions: mentions.length > 0,
      has_document_tags: documentTags.length > 0
    }
  });

  // Create notifications for mentioned users
  if (mentions.length > 0) {
    for (const mention of mentions) {
      await supabase.from('notifications').insert({
        user_id: mention.profile_id,
        title: 'You were mentioned in a message',
        message: `${message.sender?.name || 'Someone'} mentioned you in a conversation`,
        type: 'communication_mention',
        read: false,
        reference_id: message.id
      });
    }
  }

  return { message };
}

// Edit a message
async function editMessage(supabase: any, userId: string, params: any) {
  const { messageId, content } = params;

  const { data, error } = await supabase
    .from('communication_messages')
    .update({
      content,
      is_edited: true,
      edited_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('sender_id', userId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, {
    message_id: messageId,
    user_id: userId,
    action_type: 'message_edited',
    metadata: { content_preview: content.substring(0, 50) }
  });

  return { message: data };
}

// Soft delete a message
async function deleteMessage(supabase: any, userId: string, params: any) {
  const { messageId } = params;

  const { data, error } = await supabase
    .from('communication_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', userId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, {
    message_id: messageId,
    user_id: userId,
    action_type: 'message_deleted'
  });

  return { success: true };
}

// Mark messages as read
async function markRead(supabase: any, userId: string, params: any) {
  const { threadId, messageId } = params;

  // If messageId provided, mark that specific message
  if (messageId) {
    const { error } = await supabase
      .from('message_read_receipts')
      .insert({
        message_id: messageId,
        profile_id: userId
      });
    
    if (error && error.code !== '23505') throw error;
  }

  // Update participant's unread count
  const { error: updateError } = await supabase
    .from('thread_participants')
    .update({ unread_count: 0, last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('profile_id', userId);

  if (updateError) throw updateError;

  return { success: true };
}

// Get documents that can be tagged in chat
async function getTaggableDocuments(supabase: any, userId: string, params: any) {
  const { buyerId, supplierId, search } = params;

  // Get document uploads from this supplier to this buyer
  let uploadsQuery = supabase
    .from('document_uploads')
    .select(`
      id, document_name, file_name, status, expiration_date, created_at, updated_at,
      document_request:document_requests(id, title, document_type, category)
    `)
    .eq('supplier_id', supplierId);

  // Get document requests from this buyer to this supplier
  let requestsQuery = supabase
    .from('document_requests')
    .select('id, title, document_type, category, status, due_date, created_at')
    .eq('buyer_id', buyerId)
    .eq('supplier_id', supplierId);

  if (search) {
    uploadsQuery = uploadsQuery.ilike('document_name', `%${search}%`);
    requestsQuery = requestsQuery.ilike('title', `%${search}%`);
  }

  const [uploadsResult, requestsResult] = await Promise.all([
    uploadsQuery.order('created_at', { ascending: false }).limit(20),
    requestsQuery.order('created_at', { ascending: false }).limit(20)
  ]);

  if (uploadsResult.error) throw uploadsResult.error;
  if (requestsResult.error) throw requestsResult.error;

  // Format documents for tagging
  const documents = [
    ...(uploadsResult.data || []).map((doc: any) => ({
      id: doc.id,
      type: 'upload',
      name: doc.document_name || doc.file_name,
      status: doc.status,
      expirationDate: doc.expiration_date,
      category: doc.document_request?.category,
      documentType: doc.document_request?.document_type
    })),
    ...(requestsResult.data || []).map((req: any) => ({
      id: req.id,
      type: 'request',
      name: req.title,
      status: req.status,
      dueDate: req.due_date,
      category: req.category,
      documentType: req.document_type
    }))
  ];

  return { documents };
}

// Get users that can be mentioned
async function getMentionableUsers(supabase: any, userId: string, params: any) {
  const { threadId, companyId, companyType, search } = params;

  // Get the thread to know the buyer and supplier
  const { data: thread } = await supabase
    .from('communication_threads')
    .select('buyer_id, supplier_id')
    .eq('id', threadId)
    .single();

  if (!thread) throw new Error('Thread not found');

  // Determine which company's users to fetch (the other side)
  const targetCompanyId = companyType === 'buyer' ? thread.supplier_id : thread.buyer_id;
  const targetCompanyType = companyType === 'buyer' ? 'supplier' : 'buyer';

  let query = supabase
    .from('company_users')
    .select(`
      profile_id,
      role,
      profile:profiles(id, full_name, avatar_url, email)
    `)
    .eq('company_id', targetCompanyId)
    .eq('company_type', targetCompanyType)
    .eq('status', 'active');

  if (search) {
    // We need to filter after fetching since we're joining
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;

  let users = (data || []).map((cu: any) => ({
    profileId: cu.profile_id,
    name: cu.profile?.full_name || 'Unknown',
    avatarUrl: cu.profile?.avatar_url,
    email: cu.profile?.email,
    role: cu.role
  }));

  if (search) {
    const searchLower = search.toLowerCase();
    users = users.filter((u: any) => 
      u.name?.toLowerCase().includes(searchLower) || 
      u.email?.toLowerCase().includes(searchLower)
    );
  }

  return { users };
}

// Get total unread count
async function getUnreadCount(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('thread_participants')
    .select('unread_count')
    .eq('profile_id', userId)
    .eq('is_active', true);

  if (error) throw error;

  const total = (data || []).reduce((sum: number, p: any) => sum + (p.unread_count || 0), 0);
  return { unreadCount: total };
}

// Helper to log audit events
async function logAudit(supabase: any, data: any) {
  try {
    await supabase.from('communication_audit_logs').insert(data);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
