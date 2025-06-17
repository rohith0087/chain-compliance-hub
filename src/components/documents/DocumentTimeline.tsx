
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Upload,
  FileCheck,
  Calendar
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder';
  title: string;
  description: string;
  date: string;
  status?: string;
  documentTitle?: string;
}

interface DocumentTimelineProps {
  events: TimelineEvent[];
}

const DocumentTimeline = ({ events }: DocumentTimelineProps) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created': return <Clock className="w-4 h-4" />;
      case 'submitted': return <Upload className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'expired': return <AlertTriangle className="w-4 h-4" />;
      case 'reminder': return <Calendar className="w-4 h-4" />;
      default: return <FileCheck className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created': return 'text-blue-600 bg-blue-100';
      case 'submitted': return 'text-purple-600 bg-purple-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'expired': return 'text-orange-600 bg-orange-100';
      case 'reminder': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id} className="flex items-start space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>
                    <span className="text-xs text-gray-500">{formatDate(event.date)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                  {event.documentTitle && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {event.documentTitle}
                      </Badge>
                    </div>
                  )}
                </div>
                {index < events.length - 1 && (
                  <div className="absolute left-4 top-8 w-0.5 h-4 bg-gray-200"></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No activity yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentTimeline;
