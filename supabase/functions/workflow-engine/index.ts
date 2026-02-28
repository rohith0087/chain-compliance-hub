import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";
import { validateSystemSecret, systemAuthErrorResponse } from "../_shared/systemAuth.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface WorkflowStep {
  id: string;
  type: 'ai_analysis' | 'decision' | 'action' | 'notification';
  prompt?: string;
  conditions?: { [key: string]: any };
  next_steps?: string[];
  action_type?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  trigger_type: string;
  steps: WorkflowStep[];
}

interface WorkflowState {
  id: string;
  template_id: string;
  current_step: string;
  context: { [key: string]: any };
  status: 'running' | 'completed' | 'failed' | 'paused';
  ai_responses: { [step_id: string]: any };
}

async function callOpenAI(prompt: string, context: any): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        {
          role: 'system',
          content: `You are an intelligent workflow engine that analyzes data and makes decisions. Always respond with valid JSON containing:
          - decision: your main decision/recommendation
          - confidence: score from 0-100
          - reasoning: brief explanation
          - next_action: suggested next step
          - metadata: any additional structured data
          
          Context: ${JSON.stringify(context)}`
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (e) {
    return { decision: content, confidence: 80, reasoning: 'Raw response', next_action: 'continue' };
  }
}

async function executeWorkflowStep(
  workflow: WorkflowState,
  step: WorkflowStep,
  templates: WorkflowTemplate[]
): Promise<{ nextSteps: string[], updated_context: any, ai_response?: any }> {
  console.log(`Executing step: ${step.id} (${step.type})`);
  
  let nextSteps: string[] = [];
  let updated_context = { ...workflow.context };
  let ai_response = null;

  switch (step.type) {
    case 'ai_analysis':
      if (step.prompt) {
        ai_response = await callOpenAI(step.prompt, workflow.context);
        updated_context.last_ai_response = ai_response;
        
        // Dynamic next step selection based on AI response
        if (ai_response.confidence > 90) {
          nextSteps = step.next_steps?.filter(s => s.includes('high_confidence')) || step.next_steps || [];
        } else if (ai_response.confidence < 50) {
          nextSteps = step.next_steps?.filter(s => s.includes('low_confidence')) || step.next_steps || [];
        } else {
          nextSteps = step.next_steps || [];
        }
      }
      break;

    case 'decision':
      if (step.conditions && workflow.context.last_ai_response) {
        const aiResponse = workflow.context.last_ai_response;
        const conditionMet = evaluateConditions(step.conditions, aiResponse);
        nextSteps = conditionMet ? step.next_steps || [] : [];
      }
      break;

    case 'action':
      await executeAction(step.action_type!, workflow.context);
      nextSteps = step.next_steps || [];
      break;

    case 'notification':
      await sendNotification(workflow.context);
      nextSteps = step.next_steps || [];
      break;
  }

  return { nextSteps, updated_context, ai_response };
}

function evaluateConditions(conditions: any, aiResponse: any): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    if (key === 'confidence_above' && aiResponse.confidence <= value) return false;
    if (key === 'confidence_below' && aiResponse.confidence >= value) return false;
    if (key === 'decision_equals' && aiResponse.decision !== value) return false;
  }
  return true;
}

async function executeAction(actionType: string, context: any): Promise<void> {
  console.log(`Executing action: ${actionType}`);
  
  switch (actionType) {
    case 'approve_document':
      await supabase
        .from('document_uploads')
        .update({ status: 'approved', ai_processed: true })
        .eq('id', context.document_id);
      break;
      
    case 'reject_document':
      await supabase
        .from('document_uploads')
        .update({ 
          status: 'rejected', 
          ai_processed: true,
          rejection_reason: context.last_ai_response?.reasoning 
        })
        .eq('id', context.document_id);
      break;
      
    case 'request_clarification':
      // Trigger clarification workflow
      await supabase.functions.invoke('send-rejection-notification', {
        body: { 
          document_id: context.document_id,
          message: context.last_ai_response?.reasoning 
        }
      });
      break;
      
    case 'escalate_to_human':
      await supabase
        .from('document_uploads')
        .update({ status: 'pending_manual_review', ai_processed: true })
        .eq('id', context.document_id);
      break;

    case 'generate_document':
      await generateDocument(context);
      break;
  }
}

async function generateDocument(context: any): Promise<void> {
  const prompt = `Generate a compliance document based on the following requirements:
  
  Document Type: ${context.document_type}
  Industry: ${context.industry}
  Requirements: ${JSON.stringify(context.requirements)}
  
  Create a professional document that meets all compliance requirements.`;

  const aiResponse = await callOpenAI(prompt, context);
  
  // Store generated document
  await supabase
    .from('ai_generated_documents')
    .insert({
      supplier_id: context.supplier_id,
      document_type: context.document_type,
      content: aiResponse.decision,
      status: 'draft',
      metadata: aiResponse.metadata
    });
}

async function sendNotification(context: any): Promise<void> {
  await supabase
    .from('notifications')
    .insert({
      user_id: context.user_id,
      title: 'Workflow Update',
      message: context.last_ai_response?.reasoning || 'Workflow step completed',
      type: 'workflow_update',
      reference_id: context.workflow_id
    });
}

async function startWorkflow(templateId: string, triggerContext: any): Promise<string> {
  const { data: template } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (!template) {
    throw new Error('Workflow template not found');
  }

  const workflowId = crypto.randomUUID();
  const workflowState: WorkflowState = {
    id: workflowId,
    template_id: templateId,
    current_step: template.steps[0].id,
    context: triggerContext,
    status: 'running',
    ai_responses: {}
  };

  await supabase
    .from('workflow_states')
    .insert({
      id: workflowId,
      template_id: templateId,
      current_step: template.steps[0].id,
      context: triggerContext,
      status: 'running',
      ai_responses: {}
    });

  // Start executing the workflow
  await continueWorkflow(workflowId);
  
  return workflowId;
}

async function continueWorkflow(workflowId: string): Promise<void> {
  const { data: workflowState } = await supabase
    .from('workflow_states')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (!workflowState || workflowState.status !== 'running') {
    return;
  }

  const { data: template } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('id', workflowState.template_id)
    .single();

  if (!template) {
    throw new Error('Workflow template not found');
  }

  const currentStep = template.steps.find((s: WorkflowStep) => s.id === workflowState.current_step);
  if (!currentStep) {
    // Workflow completed
    await supabase
      .from('workflow_states')
      .update({ status: 'completed' })
      .eq('id', workflowId);
    return;
  }

  try {
    const { nextSteps, updated_context, ai_response } = await executeWorkflowStep(
      workflowState,
      currentStep,
      [template]
    );

    const updatedAiResponses = { ...workflowState.ai_responses };
    if (ai_response) {
      updatedAiResponses[currentStep.id] = ai_response;
    }

    if (nextSteps.length === 0) {
      // Workflow completed
      await supabase
        .from('workflow_states')
        .update({ 
          status: 'completed',
          context: updated_context,
          ai_responses: updatedAiResponses
        })
        .eq('id', workflowId);
    } else {
      // Continue to next step
      const nextStep = nextSteps[0]; // Take first next step for now
      await supabase
        .from('workflow_states')
        .update({ 
          current_step: nextStep,
          context: updated_context,
          ai_responses: updatedAiResponses
        })
        .eq('id', workflowId);

      // Continue workflow execution
      setTimeout(() => continueWorkflow(workflowId), 1000);
    }

  } catch (error) {
    console.error('Workflow execution error:', error);
    await supabase
      .from('workflow_states')
      .update({ 
        status: 'failed',
        context: { ...workflowState.context, error: error.message }
      })
      .eq('id', workflowId);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Validate system secret for cron/internal invocations
  if (!validateSystemSecret(req)) {
    return systemAuthErrorResponse(corsHeaders);
  }

  try {
    const { action, ...params } = await req.json();

    switch (action) {
      case 'start_workflow':
        const workflowId = await startWorkflow(params.template_id, params.context);
        return new Response(
          JSON.stringify({ success: true, workflow_id: workflowId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'continue_workflow':
        await continueWorkflow(params.workflow_id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get_workflow_status':
        const { data: status } = await supabase
          .from('workflow_states')
          .select('*')
          .eq('id', params.workflow_id)
          .single();
        
        return new Response(
          JSON.stringify({ success: true, workflow: status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Workflow engine error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});