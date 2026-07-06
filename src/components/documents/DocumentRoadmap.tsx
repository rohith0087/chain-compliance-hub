
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Calendar,
  Target
} from 'lucide-react';

interface RoadmapItem {
  id: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'overdue';
  dueDate?: string;
  completedDate?: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface DocumentRoadmapProps {
  items: RoadmapItem[];
  title?: string;
  showProgress?: boolean;
}

const DocumentRoadmap = ({ items, title = "Document Compliance Roadmap", showProgress = true }: DocumentRoadmapProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Target className="w-4 h-4 text-muted-foreground/70" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const completedItems = items.filter(item => item.status === 'completed').length;
  const progressPercentage = items.length > 0 ? (completedItems / items.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          {title}
        </CardTitle>
        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{completedItems} of {items.length} completed</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="relative">
                <div className="flex items-start space-x-4 p-4 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(item.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={getPriorityColor(item.priority)}>
                          {item.priority}
                        </Badge>
                        <Badge className={getStatusColor(item.status)} variant="secondary">
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      {item.dueDate && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Due: {formatDate(item.dueDate)}</span>
                        </div>
                      )}
                      {item.completedDate && (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Completed: {formatDate(item.completedDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {index < items.length - 1 && (
                  <div className="absolute left-6 top-12 w-0.5 h-8 bg-muted"></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
            <p className="text-muted-foreground">No roadmap items available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentRoadmap;
