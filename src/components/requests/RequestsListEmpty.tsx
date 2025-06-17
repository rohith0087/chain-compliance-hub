
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock } from 'lucide-react';

const RequestsListEmpty = () => {
  return (
    <Card>
      <CardContent className="text-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Document Requests Yet</h3>
            <p className="text-gray-500 max-w-sm">
              Document requests will appear here. Create your first request to get started with compliance tracking.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            Start by creating a new document request
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RequestsListEmpty;
