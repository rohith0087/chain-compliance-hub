import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileX, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface IssueGroup {
  type: string;
  issues: string[];
}

interface IssuesPanelProps {
  groups: IssueGroup[];
}

const getGroupConfig = (type: string) => {
  switch (type.toLowerCase()) {
    case 'expired_documents':
    case 'expired':
      return {
        icon: FileX,
        title: 'Expired Documents',
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
      };
    case 'missing_documents':
    case 'missing':
      return {
        icon: AlertCircle,
        title: 'Missing Documents',
        color: 'text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
      };
    case 'pending_review':
    case 'pending':
      return {
        icon: Clock,
        title: 'Pending Review',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
      };
    case 'expiring_soon':
    case 'expiring':
      return {
        icon: AlertTriangle,
        title: 'Expiring Soon',
        color: 'text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400',
      };
    default:
      return {
        icon: AlertTriangle,
        title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/50',
        borderColor: 'border-border',
        badgeClass: 'bg-muted text-muted-foreground',
      };
  }
};

export const IssuesPanel: React.FC<IssuesPanelProps> = ({ groups }) => {
  const totalIssues = groups.reduce((sum, g) => sum + g.issues.length, 0);
  
  return (
    <Card className="p-4 border-l-4 border-l-destructive/50 bg-card">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h3 className="font-semibold text-lg text-foreground">Issues Identified</h3>
        <Badge variant="destructive" className="ml-auto">
          {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      <div className="space-y-4">
        {groups.map((group, groupIndex) => {
          const config = getGroupConfig(group.type);
          const Icon = config.icon;
          
          return (
            <div 
              key={groupIndex} 
              className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="font-medium text-sm text-foreground">{config.title}</span>
                <Badge variant="outline" className={`ml-auto text-xs ${config.badgeClass}`}>
                  {group.issues.length}
                </Badge>
              </div>
              
              <ul className="space-y-1.5">
                {group.issues.map((issue, issueIndex) => (
                  <li 
                    key={issueIndex} 
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default IssuesPanel;
