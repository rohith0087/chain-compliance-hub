
# Add Refresh Summary Icon to Approved Document Modal

## Overview

Add a refresh icon button to the summary card in the Approved Document Summary Modal that allows users to regenerate the AI summary when the output is not satisfactory. When hovered, it shows a tooltip "Refresh Summary".

## UI Design

The refresh icon will be placed in the summary card header, next to the version/status badges. It will:
- Only appear when the current version has a completed summary (status = 'completed')
- Show a spinning animation while regenerating
- Display a tooltip on hover: "Refresh Summary"
- Use the existing `backfill-buyer-document-content` edge function with `document_upload_id`

```text
+----------------------------------------------------------+
| V1 — Current   [AI Analyzed]              [↻ Refresh]    |
+----------------------------------------------------------+
| Summary text content...                                   |
+----------------------------------------------------------+
```

## Technical Implementation

### File: `src/components/documents/ApprovedDocumentSummaryModal.tsx`

**1. Add RefreshCw icon import:**
```typescript
import {
  // ... existing imports
  RefreshCw,  // Add this
} from 'lucide-react';
```

**2. Add Tooltip imports:**
```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
```

**3. Add state for refresh operation in the main component:**
```typescript
const [refreshing, setRefreshing] = useState(false);
const [refreshError, setRefreshError] = useState<string | null>(null);
```

**4. Add refresh handler function:**
```typescript
const handleRefreshSummary = async () => {
  if (!current?.id) return;
  
  setRefreshing(true);
  setRefreshError(null);
  
  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      'backfill-buyer-document-content',
      { body: { document_upload_id: current.id } }
    );
    
    if (fnError) throw fnError;
    
    if (data?.success) {
      // Trigger a re-fetch of the document data
      // The modal receives document as prop, so we need to trigger parent refresh
      fetchActivityChain(); // This will update activities
      // Show success feedback (optional toast)
    } else {
      setRefreshError(data?.error || 'Failed to refresh summary');
    }
  } catch (err) {
    console.error('Error refreshing summary:', err);
    setRefreshError(err instanceof Error ? err.message : 'Failed to refresh');
  } finally {
    setRefreshing(false);
  }
};
```

**5. Add onRefresh prop to trigger parent data refresh:**
```typescript
interface ApprovedDocumentSummaryModalProps {
  // ... existing props
  onRefresh?: () => void;  // New prop to trigger parent data refresh
}
```

**6. Add refresh icon button in the summary card header (around line 443-452):**

The button will be added to the flex container that holds the badges:

```tsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <Badge variant="outline" className="font-medium">
      V{current?.version || 1} — Current
    </Badge>
    <Badge className={`${extractionStatus.className} border`}>
      {extractionStatus.icon}
      <span className="ml-1">{extractionStatus.label}</span>
    </Badge>
  </div>
  
  {/* Refresh Summary Button - only show when summary exists */}
  {current?.content_extraction_status === 'completed' && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-[#003f88]"
            onClick={handleRefreshSummary}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{refreshing ? 'Refreshing...' : 'Refresh Summary'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
</div>
```

**7. Add error display below the summary (optional):**
```tsx
{refreshError && (
  <div className="mt-2 p-2 bg-destructive/10 rounded border border-destructive/30 text-xs text-destructive">
    {refreshError}
  </div>
)}
```

**8. Update parent components to pass onRefresh prop:**

In `BuyerDocumentsDashboard.tsx`, when rendering the modal, pass a refresh callback that invalidates the query:

```tsx
<ApprovedDocumentSummaryModal
  // ... existing props
  onRefresh={() => queryClient.invalidateQueries({ queryKey: ['buyer-documents'] })}
/>
```

## User Experience Flow

1. User clicks on an approved document card
2. Summary modal opens showing the AI-generated summary
3. If the summary is poor/incorrect, user hovers over the refresh icon → sees "Refresh Summary" tooltip
4. User clicks refresh icon → icon spins, showing "Refreshing..."
5. After completion:
   - Success: Summary content updates with new analysis
   - Failure: Error message displays below the summary
6. Knowledge base is automatically updated as part of the backfill process

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/documents/ApprovedDocumentSummaryModal.tsx` | Add RefreshCw icon, Tooltip imports, refresh state, handler, and refresh button in UI |
| `src/components/documents/BuyerDocumentsDashboard.tsx` | Pass `onRefresh` prop to modal for query invalidation |

## Edge Cases Handled

- Button disabled while refreshing (prevents double-clicks)
- Error message displayed if refresh fails
- Loading state with spinning icon
- Tooltip changes to "Refreshing..." during operation
- Only shows refresh button when summary already exists (completed status)
