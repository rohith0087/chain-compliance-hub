import React from 'react';
import { SupplierGrid } from './SupplierGrid';
import { EntityDetailsCard } from './EntityDetailsCard';
import { IssuesPanel } from './IssuesPanel';
import { ActionsChecklist } from './ActionsChecklist';
import { ImpactStatement } from './ImpactStatement';
import { EmailDraftCard } from './EmailDraftCard';
import { MetadataPanel } from './MetadataPanel';
import { DocumentTable } from './DocumentTable';

interface StructuredResponseRendererProps {
  content: string;
  onEmailSupplier?: (entity: { id: string; name?: string; email?: string }) => void;
  onViewSupplierDetails?: (entity: { id: string; name?: string; email?: string }) => void;
}

interface ParsedSection {
  type: string;
  data: any;
  raw: string;
}

// Parse structured HTML-like tags from AI response
function parseStructuredResponse(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  
  // Check if content contains structured tags
  if (!content.includes('<COMPLIANCE_SUMMARY>') && !content.includes('<ENTITY_LIST>') && !content.includes('<DOCUMENT_LIST')) {
    return sections;
  }
  
  // Parse ENTITY_LIST
  const entityListMatch = content.match(/<ENTITY_LIST[^>]*>([\s\S]*?)<\/ENTITY_LIST>/i);
  if (entityListMatch) {
    const listContent = entityListMatch[1];
    const typeMatch = entityListMatch[0].match(/type="([^"]+)"/);
    const countMatch = entityListMatch[0].match(/count="(\d+)"/);
    
    const entities: any[] = [];
    const entityMatches = listContent.matchAll(/<ENTITY[^>]*>([\s\S]*?)<\/ENTITY>/gi);
    
    for (const match of entityMatches) {
      const entityContent = match[1];
      const idMatch = match[0].match(/id="([^"]+)"/);
      
      const entity: any = {
        id: idMatch?.[1] || '',
      };
      
      // Extract fields
      const nameMatch = entityContent.match(/<NAME>([\s\S]*?)<\/NAME>/i);
      const emailMatch = entityContent.match(/<EMAIL>([\s\S]*?)<\/EMAIL>/i);
      const industryMatch = entityContent.match(/<INDUSTRY>([\s\S]*?)<\/INDUSTRY>/i);
      const statusMatch = entityContent.match(/<STATUS>([\s\S]*?)<\/STATUS>/i);
      const addressMatch = entityContent.match(/<ADDRESS>([\s\S]*?)<\/ADDRESS>/i);
      const phoneMatch = entityContent.match(/<PHONE>([\s\S]*?)<\/PHONE>/i);
      const complianceMatch = entityContent.match(/<COMPLIANCE_SCORE>([\s\S]*?)<\/COMPLIANCE_SCORE>/i);
      
      if (nameMatch) entity.name = nameMatch[1].trim();
      if (emailMatch) entity.email = emailMatch[1].trim();
      if (industryMatch) entity.industry = industryMatch[1].trim();
      if (statusMatch) entity.status = statusMatch[1].trim();
      if (addressMatch) entity.address = addressMatch[1].trim();
      if (phoneMatch) entity.phone = phoneMatch[1].trim();
      if (complianceMatch) entity.compliance_score = complianceMatch[1].trim();
      
      entities.push(entity);
    }
    
    sections.push({
      type: 'entity_list',
      data: {
        entityType: typeMatch?.[1] || 'suppliers',
        count: parseInt(countMatch?.[1] || '0', 10) || entities.length,
        entities,
      },
      raw: entityListMatch[0],
    });
  }
  
  // Parse DOCUMENT_LIST
  const documentListMatch = content.match(/<DOCUMENT_LIST[^>]*>([\s\S]*?)<\/DOCUMENT_LIST>/i);
  if (documentListMatch) {
    const listContent = documentListMatch[1];
    const countMatch = documentListMatch[0].match(/count="(\d+)"/);
    
    const documents: any[] = [];
    const documentMatches = listContent.matchAll(/<DOCUMENT[^>]*>([\s\S]*?)<\/DOCUMENT>/gi);
    
    for (const match of documentMatches) {
      const docContent = match[1];
      const idMatch = match[0].match(/id="([^"]+)"/);
      
      const doc: any = {
        id: idMatch?.[1] || `doc_${documents.length}`,
      };
      
      // Extract fields
      const titleMatch = docContent.match(/<TITLE>([\s\S]*?)<\/TITLE>/i);
      const statusMatch = docContent.match(/<STATUS>([\s\S]*?)<\/STATUS>/i);
      const expirationMatch = docContent.match(/<EXPIRATION_DATE>([\s\S]*?)<\/EXPIRATION_DATE>/i);
      const createdMatch = docContent.match(/<CREATED_AT>([\s\S]*?)<\/CREATED_AT>/i);
      const filePathMatch = docContent.match(/<FILE_PATH>([\s\S]*?)<\/FILE_PATH>/i);
      const supplierMatch = docContent.match(/<SUPPLIER_NAME>([\s\S]*?)<\/SUPPLIER_NAME>/i);
      
      if (titleMatch) doc.title = titleMatch[1].trim();
      if (statusMatch) doc.status = statusMatch[1].trim();
      if (expirationMatch) doc.expiration_date = expirationMatch[1].trim();
      if (createdMatch) doc.created_at = createdMatch[1].trim();
      if (filePathMatch) doc.file_path = filePathMatch[1].trim();
      if (supplierMatch) doc.supplier_name = supplierMatch[1].trim();
      
      documents.push(doc);
    }
    
    sections.push({
      type: 'document_list',
      data: {
        count: parseInt(countMatch?.[1] || '0', 10) || documents.length,
        documents,
      },
      raw: documentListMatch[0],
    });
  }
  
  // Parse ENTITY_DETAILS
  const entityDetailsMatch = content.match(/<ENTITY_DETAILS>([\s\S]*?)<\/ENTITY_DETAILS>/i);
  if (entityDetailsMatch) {
    const detailsContent = entityDetailsMatch[1];
    const fields: { label: string; value: string; status?: string }[] = [];
    
    const fieldMatches = detailsContent.matchAll(/<FIELD[^>]*>([\s\S]*?)<\/FIELD>/gi);
    for (const match of fieldMatches) {
      const labelMatch = match[0].match(/label="([^"]+)"/);
      const statusMatch = match[0].match(/status="([^"]+)"/);
      
      fields.push({
        label: labelMatch?.[1] || '',
        value: match[1].trim(),
        status: statusMatch?.[1],
      });
    }
    
    sections.push({
      type: 'entity_details',
      data: { fields },
      raw: entityDetailsMatch[0],
    });
  }
  
  // Parse ISSUES_IDENTIFIED
  const issuesMatch = content.match(/<ISSUES_IDENTIFIED>([\s\S]*?)<\/ISSUES_IDENTIFIED>/i);
  if (issuesMatch) {
    const issuesContent = issuesMatch[1];
    const issueGroups: { type: string; issues: string[] }[] = [];
    
    const groupMatches = issuesContent.matchAll(/<ISSUE_GROUP[^>]*>([\s\S]*?)<\/ISSUE_GROUP>/gi);
    for (const match of groupMatches) {
      const typeMatch = match[0].match(/type="([^"]+)"/);
      const issues: string[] = [];
      
      const issueMatches = match[1].matchAll(/<ISSUE>([\s\S]*?)<\/ISSUE>/gi);
      for (const issueMatch of issueMatches) {
        issues.push(issueMatch[1].trim());
      }
      
      issueGroups.push({
        type: typeMatch?.[1] || 'general',
        issues,
      });
    }
    
    sections.push({
      type: 'issues',
      data: { groups: issueGroups },
      raw: issuesMatch[0],
    });
  }
  
  // Parse IMPACT
  const impactMatch = content.match(/<IMPACT>([\s\S]*?)<\/IMPACT>/i);
  if (impactMatch) {
    sections.push({
      type: 'impact',
      data: { content: impactMatch[1].trim() },
      raw: impactMatch[0],
    });
  }
  
  // Parse RECOMMENDED_ACTIONS
  const actionsMatch = content.match(/<RECOMMENDED_ACTIONS>([\s\S]*?)<\/RECOMMENDED_ACTIONS>/i);
  if (actionsMatch) {
    const actionsContent = actionsMatch[1];
    const actions: { text: string; priority?: string }[] = [];
    
    const actionMatches = actionsContent.matchAll(/<ACTION[^>]*>([\s\S]*?)<\/ACTION>/gi);
    for (const match of actionMatches) {
      const priorityMatch = match[0].match(/priority="([^"]+)"/);
      actions.push({
        text: match[1].trim(),
        priority: priorityMatch?.[1],
      });
    }
    
    sections.push({
      type: 'actions',
      data: { actions },
      raw: actionsMatch[0],
    });
  }
  
  // Parse FOLLOW_UP_EMAIL_DRAFT
  const emailMatch = content.match(/<FOLLOW_UP_EMAIL_DRAFT>([\s\S]*?)<\/FOLLOW_UP_EMAIL_DRAFT>/i);
  if (emailMatch) {
    const emailContent = emailMatch[1];
    const subjectMatch = emailContent.match(/<SUBJECT>([\s\S]*?)<\/SUBJECT>/i);
    const bodyMatch = emailContent.match(/<BODY>([\s\S]*?)<\/BODY>/i);
    
    sections.push({
      type: 'email_draft',
      data: {
        subject: subjectMatch?.[1]?.trim() || '',
        body: bodyMatch?.[1]?.trim() || emailContent.trim(),
      },
      raw: emailMatch[0],
    });
  }
  
  // Parse SYSTEM_METADATA
  const metadataMatch = content.match(/<SYSTEM_METADATA>([\s\S]*?)<\/SYSTEM_METADATA>/i);
  if (metadataMatch) {
    const metadataContent = metadataMatch[1];
    const metadata: Record<string, string> = {};
    
    const metaMatches = metadataContent.matchAll(/<META[^>]*>([\s\S]*?)<\/META>/gi);
    for (const match of metaMatches) {
      const keyMatch = match[0].match(/key="([^"]+)"/);
      if (keyMatch) {
        metadata[keyMatch[1]] = match[1].trim();
      }
    }
    
    // Also parse simple key: value format
    const lines = metadataContent.split('\n');
    for (const line of lines) {
      const kvMatch = line.match(/^\s*(\w+):\s*(.+)\s*$/);
      if (kvMatch) {
        metadata[kvMatch[1]] = kvMatch[2];
      }
    }
    
    sections.push({
      type: 'metadata',
      data: { metadata },
      raw: metadataMatch[0],
    });
  }
  
  return sections;
}

// Check if content has structured tags
export function hasStructuredContent(content: string): boolean {
  return (
    content.includes('<COMPLIANCE_SUMMARY>') ||
    content.includes('<ENTITY_LIST') ||
    content.includes('<DOCUMENT_LIST') ||
    content.includes('<ENTITY_DETAILS>') ||
    content.includes('<ISSUES_IDENTIFIED>') ||
    content.includes('<RECOMMENDED_ACTIONS>')
  );
}

export const StructuredResponseRenderer: React.FC<StructuredResponseRendererProps> = ({ 
  content, 
  onEmailSupplier, 
  onViewSupplierDetails 
}) => {
  const sections = parseStructuredResponse(content);
  
  if (sections.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        switch (section.type) {
          case 'entity_list':
            return (
              <SupplierGrid 
                key={index} 
                entities={section.data.entities} 
                entityType={section.data.entityType}
                count={section.data.count}
                onEmailClick={onEmailSupplier}
                onViewDetails={onViewSupplierDetails}
              />
            );
          case 'entity_details':
            return <EntityDetailsCard key={index} fields={section.data.fields} />;
          case 'document_list':
            return <DocumentTable key={index} documents={section.data.documents} count={section.data.count} />;
          case 'issues':
            return <IssuesPanel key={index} groups={section.data.groups} />;
          case 'impact':
            return <ImpactStatement key={index} content={section.data.content} />;
          case 'actions':
            return <ActionsChecklist key={index} actions={section.data.actions} />;
          case 'email_draft':
            return <EmailDraftCard key={index} subject={section.data.subject} body={section.data.body} />;
          case 'metadata':
            return <MetadataPanel key={index} metadata={section.data.metadata} />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default StructuredResponseRenderer;
