
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardCheck, ArrowLeft, X } from 'lucide-react';
import { ComplianceDocument } from './ComplianceDocuments';

interface DocumentSelectionStepProps {
  complianceDocuments: ComplianceDocument[];
  selectedDocuments: ComplianceDocument[];
  onDocumentToggle: (doc: ComplianceDocument, checked: boolean) => void;
  onRemoveSelected: (docId: string) => void;
  onNext: () => void;
}

const DocumentSelectionStep = ({
  complianceDocuments,
  selectedDocuments,
  onDocumentToggle,
  onRemoveSelected,
  onNext
}: DocumentSelectionStepProps) => {
  return (
    <div className="space-y-6">
      {/* Selected Documents Summary */}
      {selectedDocuments.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Selected Documents ({selectedDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedDocuments.map((doc) => (
                <Badge 
                  key={doc.id} 
                  variant="secondary" 
                  className="flex items-center gap-1 px-3 py-1"
                >
                  {doc.title}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-600" 
                    onClick={() => onRemoveSelected(doc.id)}
                  />
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button 
                onClick={onNext}
                disabled={selectedDocuments.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Configure Requests
                <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Selection Grid */}
      <div className="grid gap-4">
        {complianceDocuments.map((doc) => (
          <Card 
            key={doc.id} 
            className={`cursor-pointer transition-all border-l-4 ${
              selectedDocuments.find(d => d.id === doc.id) 
                ? 'border-l-blue-500 bg-blue-50 shadow-md' 
                : 'border-l-gray-300 hover:shadow-md hover:border-l-blue-400'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={!!selectedDocuments.find(d => d.id === doc.id)}
                    onCheckedChange={(checked) => onDocumentToggle(doc, checked as boolean)}
                  />
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <doc.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{doc.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{doc.category}</Badge>
                      <Badge variant="outline">{doc.regulatoryBody}</Badge>
                      {doc.required && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">{doc.description}</p>
              <div className="text-sm text-gray-500">
                <strong>Template includes:</strong> {doc.template.sections.map(s => s.name).join(', ')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DocumentSelectionStep;
