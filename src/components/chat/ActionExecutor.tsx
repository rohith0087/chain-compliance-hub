import React, { useState } from 'react';
import logger from '@/utils/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, Send, Bell, FileText, Calendar } from 'lucide-react';

interface ActionItem {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimated_time: string;
  action_type: string;
  parameters: Record<string, any>;
}

interface SuggestedAction {
  label: string;
  description: string;
  action_type: string;
  parameters: Record<string, any>;
  urgency: 'low' | 'medium' | 'high';
}

interface QuickAction {
  label: string;
  action: string;
  action_type?: string;
  parameters?: Record<string, any>;
  data?: any;
}

interface ActionExecutorProps {
  actionItems?: ActionItem[];
  suggestedActions?: SuggestedAction[];
  quickActions?: QuickAction[];
  sessionId: string;
  onActionComplete?: (result: any) => void;
}

interface ExecutionState {
  [key: string]: 'idle' | 'executing' | 'success' | 'error';
}

interface ExecutionResult {
  [key: string]: {
    message: string;
    timestamp: Date;
    details?: any;
  };
}

const ActionExecutor: React.FC<ActionExecutorProps> = ({
  actionItems = [],
  suggestedActions = [],
  quickActions = [],
  sessionId,
  onActionComplete
}) => {
  const [executionStates, setExecutionStates] = useState<ExecutionState>({});
  const [executionResults, setExecutionResults] = useState<ExecutionResult>({});
  const { toast } = useToast();

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'send_follow_up_email':
      case 'send_document_expiry_alert':
        return <Send className="w-4 h-4" />;
      case 'create_reminder':
        return <Bell className="w-4 h-4" />;
      case 'request_additional_documents':
      case 'generate_compliance_report':
        return <FileText className="w-4 h-4" />;
      case 'schedule_meeting':
        return <Calendar className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const executeAction = async (actionType: string, parameters: Record<string, any>, actionId: string) => {
    setExecutionStates(prev => ({ ...prev, [actionId]: 'executing' }));

    try {
      logger.debug('Executing action:', { actionType, parameters });

      const { data, error } = await supabase.functions.invoke('execute-chat-action', {
        body: {
          action_type: actionType,
          parameters,
          session_id: sessionId,
          context: { executed_at: new Date().toISOString() }
        }
      });

      if (error) throw error;

      if (data?.success) {
        setExecutionStates(prev => ({ ...prev, [actionId]: 'success' }));
        setExecutionResults(prev => ({
          ...prev,
          [actionId]: {
            message: data.message,
            timestamp: new Date(),
            details: data
          }
        }));

        toast({
          title: "Action Completed",
          description: data.message,
        });

        if (onActionComplete) {
          onActionComplete(data);
        }
      } else {
        throw new Error(data?.message || 'Action failed');
      }
    } catch (error) {
      console.error('Action execution failed:', error);
      setExecutionStates(prev => ({ ...prev, [actionId]: 'error' }));
      setExecutionResults(prev => ({
        ...prev,
        [actionId]: {
          message: error.message || 'Action failed',
          timestamp: new Date()
        }
      }));

      toast({
        title: "Action Failed", 
        description: error.message || 'Failed to execute action',
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'executing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-danger" />;
      default:
        return null;
    }
  };

  const allActions = [
    ...actionItems.map((item, index) => ({
      id: `action-${index}`,
      type: 'actionItem',
      label: item.description,
      description: `Priority: ${item.priority} | Est. time: ${item.estimated_time}`,
      action_type: item.action_type,
      parameters: item.parameters,
      priority: item.priority,
      badge: item.priority
    })),
    ...suggestedActions.map((action, index) => ({
      id: `suggested-${index}`,
      type: 'suggested',
      label: action.label,
      description: action.description,
      action_type: action.action_type,
      parameters: action.parameters,
      priority: action.urgency,
      badge: action.urgency
    })),
    ...quickActions.filter(qa => qa.action_type && qa.action_type !== 'navigate').map((action, index) => ({
      id: `quick-${index}`,
      type: 'quick',
      label: action.label,
      description: `Quick action`,
      action_type: action.action_type,
      parameters: action.parameters || {},
      priority: 'medium' as const,
      badge: 'quick'
    }))
  ];

  if (allActions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Available Actions</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {allActions.length} action{allActions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid gap-3">
        {allActions.map((action) => {
          const state = executionStates[action.id] || 'idle';
          const result = executionResults[action.id];
          const isExecuting = state === 'executing';
          const isCompleted = state === 'success';
          const hasError = state === 'error';

          return (
            <Card key={action.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                    {getActionIcon(action.action_type)}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{action.label}</span>
                      <Badge variant={getPriorityColor(action.priority)} className="text-xs">
                        {action.badge}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                    
                    {result && (
                      <div className={`text-xs p-2 rounded ${
                        hasError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                      }`}>
                        {result.message}
                        {result.details && (
                          <div className="text-xs opacity-75 mt-1">
                            {result.details.emails_sent && `• ${result.details.emails_sent} email(s) sent`}
                            {result.details.notifications_sent && `• ${result.details.notifications_sent} notification(s) created`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(state)}
                  
                  <Button
                    size="sm"
                    variant={isCompleted ? "outline" : "default"}
                    disabled={isExecuting || isCompleted}
                    onClick={() => executeAction(action.action_type, action.parameters, action.id)}
                    className="shrink-0"
                  >
                    {isExecuting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {isCompleted ? 'Completed' : isExecuting ? 'Executing...' : 'Execute'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {allActions.some(action => executionStates[action.id] === 'success') && (
        <div className="text-xs text-muted-foreground text-center py-2 border-t">
          Actions are automatically logged and stakeholders are notified as needed
        </div>
      )}
    </div>
  );
};

export default ActionExecutor;