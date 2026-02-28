import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/corsHeaders.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Define supabase client once for use in request handler (service role for server ops)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// FIX #1: Create user-context client from authorization header for RLS-enforced reads
function createUserClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authHeader }
    }
  });
}

// OpenAI tools that the LLM can use
const tools = [
  {
    type: "function",
    function: {
      name: "query_documents",
      description: "Query and filter documents with flexible criteria. Use this to find documents based on status, expiration, supplier names, or document types.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "array",
            items: { type: "string", enum: ["pending_review", "approved", "rejected", "expired"] },
            description: "Filter by document status"
          },
          document_types: {
            type: "array",
            items: { type: "string" },
            description: "Filter by document types (e.g., 'Certificate of Insurance', 'Safety Data Sheet')"
          },
          supplier_names: {
            type: "array",
            items: { type: "string" },
            description: "Filter by supplier company names"
          },
          expired: {
            type: "boolean",
            description: "If true, only show expired documents. If false, show non-expired documents."
          },
          expiring_days: {
            type: "number",
            description: "Show documents expiring within this many days from now"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20, max: 100)"
          },
          page: {
            type: "number",
            description: "Page number for pagination (starts at 1)"
          },
          created_from: {
            type: "string",
            description: "Filter documents created on or after this date (YYYY-MM-DD format)"
          },
          created_to: {
            type: "string",
            description: "Filter documents created on or before this date (YYYY-MM-DD format)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_suppliers",
      read_only: true,
      description: "Query suppliers and their connection status. Use this to find suppliers by name or connection status. INFORMATIONAL ONLY.",
      parameters: {
        type: "object",
        properties: {
          supplier_names: {
            type: "array",
            items: { type: "string" },
            description: "Search for suppliers by name (partial match supported)"
          },
          connection_status: {
            type: "string",
            enum: ["pending", "approved", "rejected"],
            description: "Filter suppliers by connection status"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 20)"
          },
          page: {
            type: "number",
            description: "Page number for pagination (starts at 1)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_compliance_metrics",
      read_only: true,
      description: "Get overall compliance statistics and metrics for the buyer. Use this for questions about compliance scores, totals, or overall statistics. INFORMATIONAL ONLY.",
      parameters: {
        type: "object",
        properties: {
          window_days: {
            type: "number",
            description: "Optional: Only include documents created within the last N days (e.g., 30, 60, 90)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_document_request",
      description: "Create document requests for suppliers. Can create single or multiple requests at once. Use this when the user wants to request documents from a supplier.",
      parameters: {
        type: "object",
        properties: {
          supplier_name: {
            type: "string",
            description: "Name of the supplier to request documents from"
          },
          document_types: {
            type: "array",
            items: { type: "string" },
            description: "List of document types to request (e.g., ['ISO 9001', 'HACCP Certificate'])"
          },
          due_date: {
            type: "string",
            description: "Due date in YYYY-MM-DD format. If not specified, system will set reasonable default (14 days from now)"
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Priority level for the request"
          },
          notes: {
            type: "string",
            description: "Additional notes or instructions for the supplier"
          }
        },
        required: ["supplier_name", "document_types"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_document_sets",
      description: "Get saved document sets for the buyer. Use this to suggest document sets when the user wants to request multiple documents.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_document_timeseries",
      read_only: true,
      description: "Get time-series data for documents over a period. Perfect for line charts showing trends over time. Returns daily/weekly/monthly buckets with counts per status for easy chart rendering. ANALYSIS ONLY.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "Number of days to look back (default: 60, max: 365)"
          },
          statuses: {
            type: "array",
            items: { type: "string", enum: ["pending_review", "submitted", "approved", "rejected", "expired"] },
            description: "Specific statuses to track. Note: 'pending_review' and 'submitted' both display as 'Submitted' in charts. Use both when user asks for pending/submitted documents."
          },
          bucket_size: {
            type: "string",
            enum: ["day", "week", "month"],
            description: "Time bucket size. Auto-determined if not specified: day for <=90 days, week for 91-180, month for >180"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_missing_required_documents",
      read_only: true,
      description: "INFORMATIONAL ONLY - Find which required documents are missing from a supplier. Compares required document set against approved uploads. Reports gaps but does NOT create requests. User must explicitly confirm before creating any requests.",
      parameters: {
        type: "object",
        properties: {
          supplier_name: {
            type: "string",
            description: "Name of the supplier to check (fuzzy matching supported)"
          },
          required_set_id: {
            type: "string",
            description: "Optional: specific document set ID to check against. If not provided, uses default requirements."
          }
        },
        required: ["supplier_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_requests_for_missing",
      description: "One-click creation of document requests for ALL missing required documents from a supplier. Internally calls get_missing_required_documents to identify gaps, then creates requests for each missing document. Perfect for 'request everything missing from X' scenarios.",
      parameters: {
        type: "object",
        properties: {
          supplier_name: {
            type: "string",
            description: "Name of the supplier to request missing documents from"
          },
          required_set_id: {
            type: "string",
            description: "Optional: specific document set to use. If not provided, uses default requirements."
          },
          due_date: {
            type: "string",
            description: "Due date in YYYY-MM-DD format for all requests. Default: 14 days from now"
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Priority level for all requests. Default: medium"
          },
          notes: {
            type: "string",
            description: "Additional notes to include in all requests"
          }
        },
        required: ["supplier_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description: "Send in-app notifications to users (suppliers, team members). Use this to confirm actions were taken or alert users about important events. Creates visible notifications in the app.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["request_created", "reminder", "expiring_soon", "action_completed", "system_alert"],
            description: "Type of notification to send"
          },
          user_id: {
            type: "string",
            description: "Target user's profile ID to send notification to. Use supplier's profile_id from query results."
          },
          title: {
            type: "string",
            description: "Notification title (short, clear)"
          },
          message: {
            type: "string",
            description: "Notification message body"
          },
          reference_id: {
            type: "string",
            description: "Optional: ID of related entity (request_id, document_id, etc.)"
          }
        },
        required: ["type", "user_id", "title", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "acknowledge_and_log",
      description: "Record user approvals, confirmations, or AI actions to audit log. Use this after executing important actions to create permanent record of what was done and user's consent. Critical for compliance auditing.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "Action that was performed (e.g., 'created_document_requests', 'sent_reminders', 'exported_data')"
          },
          user_id: {
            type: "string",
            description: "Profile ID of user who initiated the action"
          },
          payload: {
            type: "object",
            description: "Complete details of what was done (parameters, results, etc.)"
          },
          entity_type: {
            type: "string",
            enum: ["document", "request", "supplier", "system"],
            description: "Type of entity the action relates to"
          },
          entity_id: {
            type: "string",
            description: "Optional: ID of specific entity affected"
          }
        },
        required: ["action", "user_id", "payload", "entity_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "export_csv",
      description: "Generate CSV export file for documents or suppliers. Returns a download URL that frontend displays as download button. Use when user says 'download', 'export', 'save as CSV', etc.",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: ["documents", "suppliers"],
            description: "Type of data to export"
          },
          query: {
            type: "object",
            description: "Same query parameters as query_documents or query_suppliers tool"
          }
        },
        required: ["resource", "query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "audit_trail",
      description: "View audit trail of activities for a specific document, request, or supplier. Shows who did what and when. Use for 'what changed', 'show history', 'who approved this', etc.",
      parameters: {
        type: "object",
        properties: {
          entity: {
            type: "string",
            enum: ["document", "request", "supplier"],
            description: "Type of entity to view history for"
          },
          entity_id: {
            type: "string",
            description: "ID of the specific entity"
          },
          limit: {
            type: "number",
            description: "Maximum number of events to return (default: 50)"
          }
        },
        required: ["entity", "entity_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_compliance_insights_dashboard",
      description: "Generate a comprehensive AI-powered compliance insights dashboard with real-time metrics, supplier performance matrix, and AI-generated actionable insights. Use this when user asks for: 'how does my day look', 'give me insights', 'show my dashboard', 'compliance overview', 'what should I focus on today', 'my daily briefing', 'show me the big picture', 'executive summary', 'compliance compass'. This returns a rich dashboard view - NOT for specific document queries or individual supplier lookups.",
      parameters: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            enum: ["7D", "30D", "90D", "1Y"],
            description: "Time range for analysis (default: 30D)"
          },
          include_supplier_matrix: {
            type: "boolean",
            description: "Whether to include detailed supplier performance matrix (default: true)"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_visualization_code",
      description: "Generate custom TypeScript React component code for data visualizations. Use when user requests charts, graphs, or dashboards that require custom formatting (e.g., 'scatter plot', 'heatmap', 'custom dashboard', 'timeline chart'). NOT for standard compliance dashboards or supplier comparisons.",
      parameters: {
        type: "object",
        properties: {
          visualization_type: {
            type: "string",
            enum: ["bar_chart", "line_chart", "area_chart", "pie_chart", "scatter_plot", "radar_chart", "composed_chart", "custom_table"],
            description: "Type of visualization to generate"
          },
          data_query: {
            type: "object",
            description: "Query parameters to fetch the data needed for visualization (uses existing query_documents/query_suppliers tools)",
            properties: {
              query_type: {
                type: "string",
                enum: ["documents", "suppliers", "metrics"],
                description: "Which data source to query"
              },
              filters: {
                type: "object",
                description: "Filters to apply to the data query"
              }
            }
          },
          chart_config: {
            type: "object",
            description: "Chart customization options",
            properties: {
              x_axis: {
                type: "string",
                description: "Field for x-axis (e.g., 'supplier_name', 'created_at', 'status', 'document_type')"
              },
              y_axis: {
                type: "string",
                description: "Field for y-axis (typically 'count' or a numeric field)"
              },
              aggregation: {
                type: "string",
                enum: ["count", "sum", "time_series", "time_series_grouped", "group_by", "group_by_multiple"],
                description: "How to aggregate data: 'count' for counting items, 'sum' for summing values, 'time_series' for time-based trends, 'time_series_grouped' for multi-series time trends, 'group_by' for simple grouping, 'group_by_multiple' for grouped bar charts"
              },
              group_by: {
                type: "string",
                description: "Secondary field to group by (for multi-series charts, e.g., 'status' to split lines by status)"
              },
              series: {
                type: "array",
                items: { type: "string" },
                description: "Specific series to show (e.g., ['approved', 'pending'] for status-based grouping)"
              },
              time_period: {
                type: "string",
                enum: ["day", "week", "month"],
                description: "Time bucket size for time_series aggregations"
              },
              title: {
                type: "string",
                description: "Chart title"
              },
              color_scheme: {
                type: "string",
                enum: ["blue", "green", "purple", "multi"],
                description: "Color scheme for the chart"
              }
            }
          }
        },
        required: ["visualization_type", "data_query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_compliance_email",
      description: "Draft compliance follow-up emails for suppliers. Use this when user says 'send email to [supplier]', 'email [supplier] about documents', 'follow up with [supplier]', 'draft email to [supplier]', clicks 'Address Now' for expired documents, or 'Schedule Renewals' for expiring documents. Automatically finds supplier by name (fuzzy matching), pulls their documents, and drafts personalized email with sender's name, role, and company. Returns draft email content that user can review and edit before sending.",
      parameters: {
        type: "object",
        properties: {
          action_type: {
            type: "string",
            enum: ["expired_documents", "expiring_documents", "pending_review", "general_followup"],
            description: "Type of compliance action triggering the email. Default to 'expired_documents' if user mentions expired docs, 'expiring_documents' for expiring soon, 'pending_review' for pending/submitted, 'general_followup' for generic follow-up."
          },
          supplier_names: {
            type: "array",
            items: { type: "string" },
            description: "Supplier names to send emails to (fuzzy matching supported). Use this when user mentions supplier by name like 'email Kerry' or 'send to Test Supplier'."
          },
          supplier_ids: {
            type: "array",
            items: { type: "string" },
            description: "Specific supplier IDs to send emails to. If not provided, will determine from document context or supplier_names."
          },
          document_ids: {
            type: "array",
            items: { type: "string" },
            description: "Specific document IDs to reference in the email"
          },
          custom_message: {
            type: "string",
            description: "Optional custom context or message to include in the email draft"
          }
        },
        required: ["action_type"]
      }
    }
  },
  // ============= DOCUMENT COMPARISON TOOLS (Hardened) =============
  {
    type: "function",
    function: {
      name: "find_documents_for_comparison",
      description: "Find and preview documents for comparison or analysis. Use when user wants to compare documents, analyze specific documents, or asks questions requiring document content (e.g., 'Compare ISO 9001 vs HACCP', 'What does my supplier agreement say about X?', 'Compare documents from Supplier A vs B'). Returns document previews with real content excerpts for user confirmation BEFORE deep analysis. ALWAYS use this first before execute_document_comparison.",
      parameters: {
        type: "object",
        properties: {
          document_search_terms: {
            type: "array",
            items: { type: "string" },
            description: "Document names, types, or keywords to search (e.g., ['ISO 9001', 'HACCP Certificate', 'Certificate of Insurance'])"
          },
          supplier_names: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Filter to specific suppliers by name (fuzzy matching supported)"
          },
          comparison_question: {
            type: "string",
            description: "The user's original comparison question to provide context for preview generation"
          },
          include_pending: {
            type: "boolean",
            description: "If true (buyer only), include submitted/pending_review documents in search. Default: false (approved only)"
          }
        },
        required: ["document_search_terms", "comparison_question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "execute_document_comparison",
      description: "Execute deep analysis and comparison of confirmed documents. ONLY call this AFTER user confirms document selection from find_documents_for_comparison results. Requires the confirmation_token returned from find_documents_for_comparison. Ingests full document content using semantic chunking and provides structured comparison with citations.",
      parameters: {
        type: "object",
        properties: {
          document_ids: {
            type: "array",
            items: { type: "string" },
            description: "IDs of confirmed documents to compare (from find_documents_for_comparison results)"
          },
          confirmation_token: {
            type: "string",
            description: "The confirmation token returned from find_documents_for_comparison (required for security)"
          },
          comparison_question: {
            type: "string",
            description: "The specific question or comparison criteria the user wants answered"
          }
        },
        required: ["document_ids", "confirmation_token", "comparison_question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_generic_email",
      description: `Draft a custom email to any email address. Use this when user wants to send an email to someone not in the supplier list, send a test email, or compose a general email.

CRITICAL WORKFLOW:
1. When user only provides email address, ASK "What would you like this email to be about?"
2. When user provides topic, ASK for body content if not clear
3. Once you have to_email, subject, and body - create the draft and SHOW IT to user for review
4. NEVER send immediately - always show draft first and ask for confirmation
5. After user confirms ("yes", "send it", "looks good"), use confirm_send_email tool to actually send

This tool creates a DRAFT that the user MUST review before sending. For compliance follow-ups with existing suppliers, prefer draft_compliance_email instead.`,
      parameters: {
        type: "object",
        properties: {
          to_email: {
            type: "string",
            description: "Recipient email address"
          },
          to_name: {
            type: "string",
            description: "Recipient name (optional, for personalization)"
          },
          subject: {
            type: "string",
            description: "Email subject line. If user hasn't specified, ASK them what the email is about."
          },
          body: {
            type: "string",
            description: "Email body content (plain text). If user hasn't specified, ASK them for the message content."
          },
          sender_context: {
            type: "string",
            description: "Optional context about who is sending (e.g., 'Compliance Team', 'Test Email')"
          }
        },
        required: ["to_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "confirm_send_email",
      description: "Send a previously drafted email after user explicitly confirms. ONLY call this when user says things like 'yes send it', 'looks good send it', 'confirm', 'send now', 'yes', 'go ahead'. Requires the draft_id from a previous draft_generic_email call.",
      parameters: {
        type: "object",
        properties: {
          draft_id: {
            type: "string",
            description: "The draft ID returned from draft_generic_email"
          }
        },
        required: ["draft_id"]
      }
    }
  }
];

// Fuzzy matching helper functions
function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(supplier: string, query: string): boolean {
  const normSupplier = normalize(supplier);
  const normQuery = normalize(query);
  
  // Exact substring match
  if (normSupplier.includes(normQuery) || normQuery.includes(normSupplier)) {
    return true;
  }
  
  // Levenshtein distance <= 2 for typos
  if (levenshteinDistance(normSupplier, normQuery) <= 2) {
    return true;
  }
  
  // Token-level matching (any word in supplier matches any word in query)
  const supplierTokens = normSupplier.split(' ');
  const queryTokens = normQuery.split(' ');
  for (const qt of queryTokens) {
    for (const st of supplierTokens) {
      if (st.includes(qt) || qt.includes(st) || levenshteinDistance(st, qt) <= 1) {
        return true;
      }
    }
  }
  
  return false;
}

// ============= FIX #6: ROBUST JSON PARSING =============
function parseModelJSON(rawOutput: string): any {
  let cleaned = rawOutput;
  
  // Layer 1: Strip markdown code fences
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  
  // Layer 2: Remove leading/trailing non-JSON
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  // Layer 3: Fix common issues
  cleaned = cleaned
    .replace(/,\s*}/g, '}')        // Remove trailing commas in objects
    .replace(/,\s*]/g, ']')         // Remove trailing commas in arrays
    .replace(/\n/g, ' ')            // Remove newlines inside JSON
    .replace(/\s+/g, ' ');          // Normalize whitespace
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON parse failed after cleanup:', cleaned.substring(0, 200));
    
    // Layer 4: Return structured error response
    return {
      summaries: [],
      similarities: [],
      differences: [],
      answer: "I was unable to parse the comparison results. Please try again.",
      not_found: ["Analysis failed due to response format error"],
      _parse_error: true
    };
  }
}

// ============= FIX #5: SMART CONTENT SELECTION (Keyword-based relevance scoring) =============
function getRelevantChunks(content: string, question: string, maxChars: number = 4000): string {
  if (!content || content.length <= maxChars) {
    return content || '';
  }
  
  // Split into paragraphs
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
  
  // Extract keywords from question (words > 3 chars)
  const questionKeywords = question.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .map(w => w.replace(/[^a-z0-9]/g, ''));
  
  // Score each paragraph by keyword overlap
  const scored = paragraphs.map(p => {
    const lowerP = p.toLowerCase();
    const score = questionKeywords.filter(kw => lowerP.includes(kw)).length;
    return { text: p, score };
  });
  
  // Sort by score descending and take top paragraphs within budget
  scored.sort((a, b) => b.score - a.score);
  
  let result = '';
  let charCount = 0;
  
  for (const { text } of scored) {
    if (charCount + text.length > maxChars) break;
    result += text + '\n\n';
    charCount += text.length + 2;
  }
  
  // If no high-scoring paragraphs, take the beginning
  if (result.trim().length < 100) {
    return content.substring(0, maxChars);
  }
  
  return result.trim();
}

// ============= INLINE DOCUMENT CONTENT EXTRACTION =============

/**
 * Extract text content from a document using OpenAI Vision API
 * Supports PDFs (as images) and image files
 */
async function extractDocumentContentInline(filePath: string, fileName: string): Promise<string> {
  console.log(`Starting inline extraction for: ${filePath}`);
  
  // Download the file from Supabase storage
  const bucketName = 'documents';
  const cleanPath = filePath.replace(/^documents\//, '');
  
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(cleanPath);
  
  if (downloadError || !fileData) {
    console.error('Failed to download document:', downloadError);
    throw new Error(`Failed to download document: ${downloadError?.message || 'Unknown error'}`);
  }
  
  // Convert to base64
  const arrayBuffer = await fileData.arrayBuffer();
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  // Determine MIME type
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  let mimeType = 'application/octet-stream';
  if (extension === 'pdf') mimeType = 'application/pdf';
  else if (extension === 'png') mimeType = 'image/png';
  else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
  else if (extension === 'gif') mimeType = 'image/gif';
  else if (extension === 'webp') mimeType = 'image/webp';
  
  console.log(`File type: ${mimeType}, size: ${arrayBuffer.byteLength} bytes`);
  
  // For PDFs, we need to note that OpenAI Vision can process PDF pages as images
  // We'll send as-is and let OpenAI handle it, or for PDFs we use base64
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  
  // Call OpenAI Vision API to extract text
  const extractionPrompt = `You are a document text extraction assistant. Extract ALL text content from this document image/file.

INSTRUCTIONS:
1. Extract every piece of readable text from the document
2. Preserve the document structure (headings, paragraphs, lists, tables)
3. For tables, format them clearly with | separators
4. Include all dates, numbers, names, and specific details
5. If this is a certificate or compliance document, pay special attention to:
   - Certificate/document type and number
   - Issuing organization
   - Issue date and expiration date
   - Scope of certification
   - Standards referenced (ISO, HACCP, etc.)
   - Company/supplier name
   - Any conditions or limitations

Output the extracted text in a clean, readable format. Do not summarize - extract the FULL text content.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Vision-capable model
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: extractionPrompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: dataUrl,
                detail: 'high' // Use high detail for better text extraction
              } 
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for accurate extraction
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI Vision API error:', errorText);
    throw new Error(`OpenAI Vision API error: ${response.status}`);
  }

  const result = await response.json();
  const extractedText = result.choices?.[0]?.message?.content || '';
  
  console.log(`Extracted ${extractedText.length} characters from document`);
  
  return extractedText;
}

/**
 * Cache extracted content for future use
 */
async function cacheExtractedContent(documentId: string, content: string, documentType: string | null): Promise<void> {
  try {
    // Get the document's buyer_id for the knowledge entry
    const { data: doc } = await supabase
      .from('document_uploads')
      .select(`
        document_requests!inner(
          buyer_id,
          suppliers(company_name)
        )
      `)
      .eq('id', documentId)
      .single();
    
    if (!doc?.document_requests) {
      console.warn('Could not find document for caching');
      return;
    }
    
    const buyerId = doc.document_requests.buyer_id;
    const supplierName = (doc.document_requests as any).suppliers?.company_name || 'Unknown Supplier';
    
    // Upsert to ai_knowledge_entries
    const { error } = await supabase
      .from('ai_knowledge_entries')
      .upsert({
        id: crypto.randomUUID(),
        company_id: buyerId,
        company_type: 'buyer',
        entry_type: 'document',
        title: `${documentType || 'Document'} - ${supplierName}`,
        content: content,
        source_reference: documentId,
        relevance_tags: [documentType, 'extracted', 'compliance'].filter(Boolean),
        metadata: {
          extraction_method: 'inline_vision',
          extracted_at: new Date().toISOString(),
          supplier_name: supplierName
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'source_reference'
      });
    
    if (error) {
      console.error('Failed to cache extracted content:', error);
    } else {
      console.log(`Cached extracted content for document ${documentId}`);
    }
  } catch (err) {
    console.error('Error caching extracted content:', err);
  }
}

// ============= FIX #4: CONFIRMATION TOKEN MANAGEMENT =============
async function storeComparisonPending(
  sessionId: string,
  documentPreviews: any[],
  question: string
): Promise<string> {
  const confirmationToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
  
  const { error } = await supabase
    .from('chat_sessions')
    .update({
      state: {
        pending_comparison: {
          token: confirmationToken,
          document_ids: documentPreviews.map(d => d.id),
          question: question,
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }
      }
    })
    .eq('id', sessionId);
  
  if (error) {
    console.error('Failed to store comparison pending state:', error);
  }
  
  return confirmationToken;
}

async function verifyConfirmationToken(
  sessionId: string,
  userId: string,
  providedToken: string,
  requestedDocIds: string[]
): Promise<{ valid: boolean; error?: string }> {
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .select('state, user_id')
    .eq('id', sessionId)
    .single();
  
  if (error || !session) {
    return { valid: false, error: 'Session not found' };
  }
  
  const pending = (session.state as any)?.pending_comparison;
  
  if (!pending) {
    return { valid: false, error: 'No pending comparison found. Please use find_documents_for_comparison first.' };
  }
  
  if (session.user_id !== userId) {
    return { valid: false, error: 'Session mismatch - unauthorized' };
  }
  
  if (pending.token !== providedToken) {
    return { valid: false, error: 'Invalid confirmation token' };
  }
  
  if (new Date(pending.expires_at) < new Date()) {
    return { valid: false, error: 'Comparison request expired (10 min limit). Please search again.' };
  }
  
  // Validate document IDs match what was confirmed
  const confirmedIds = new Set(pending.document_ids);
  const allMatch = requestedDocIds.every(id => confirmedIds.has(id));
  if (!allMatch) {
    return { valid: false, error: 'Document IDs do not match confirmed selection. Please confirm documents first.' };
  }
  
  return { valid: true };
}

async function clearComparisonPending(sessionId: string): Promise<void> {
  await supabase
    .from('chat_sessions')
    .update({ state: { pending_comparison: null } })
    .eq('id', sessionId);
}

// ============= DOCUMENT COMPARISON HANDLERS (All 6 Fixes Applied) =============

// FIX #1 & #2: Uses userClient for RLS + SQL-level filtering
async function findDocumentsForComparison(
  params: any,
  buyerId: string,
  supplierId: string | null,
  sessionId: string | null,
  authHeader: string
) {
  console.log('findDocumentsForComparison called with:', { 
    search_terms: params.document_search_terms, 
    suppliers: params.supplier_names,
    include_pending: params.include_pending
  });
  
  try {
    // FIX #1: Use user JWT client for RLS-enforced reads
    const userClient = createUserClient(authHeader);
    
    // FIX #2 (partial): Determine allowed statuses
    const allowedStatuses = ['approved'];
    if (params.include_pending && !supplierId) {
      // Only buyers can include pending documents
      allowedStatuses.push('submitted', 'pending_review');
    }
    
    // Build query with tenant filtering at SQL level (defense-in-depth with RLS)
    let query = userClient
      .from('document_uploads')
      .select(`
        id,
        file_name,
        status,
        created_at,
        expiration_date,
        version,
        document_requests!inner(
          id,
          document_type,
          buyer_id,
          supplier_id,
          suppliers(id, company_name)
        )
      `)
      .in('status', allowedStatuses);
    
    // FIX #2: SQL-level tenant filtering (defense-in-depth)
    if (supplierId) {
      query = query.eq('document_requests.supplier_id', supplierId);
    } else if (buyerId) {
      query = query.eq('document_requests.buyer_id', buyerId);
    }
    
    // Apply supplier name filter at SQL level if provided
    // Note: Full SQL ilike filtering would require a stored procedure for OR across multiple terms
    // We do initial fetch then fuzzy match for flexibility
    
    const { data: documents, error } = await query.limit(50);
    
    if (error) {
      console.error('Error querying documents for comparison:', error);
      throw error;
    }
    
    console.log(`Found ${documents?.length || 0} documents before filtering`);
    
    // FIX #2 (continued): Fuzzy match document types and supplier names
    let matchedDocs = documents?.filter((doc: any) => {
      const docType = doc.document_requests?.document_type?.toLowerCase() || '';
      const fileName = doc.file_name?.toLowerCase() || '';
      const supplierName = doc.document_requests?.suppliers?.company_name?.toLowerCase() || '';
      
      // Check document type/name match
      const docMatches = params.document_search_terms.some((term: string) => {
        const normalizedTerm = term.toLowerCase().replace(/[_-]/g, ' ');
        const normalizedDocType = docType.replace(/[_-]/g, ' ');
        const normalizedFileName = fileName.replace(/[_-]/g, ' ');
        return normalizedDocType.includes(normalizedTerm) || 
               normalizedTerm.includes(normalizedDocType) ||
               normalizedFileName.includes(normalizedTerm);
      });
      
      // Check supplier name filter if provided
      if (params.supplier_names && params.supplier_names.length > 0) {
        const supplierMatches = params.supplier_names.some((name: string) => 
          fuzzyMatch(supplierName, name)
        );
        return docMatches && supplierMatches;
      }
      
      return docMatches;
    }) || [];
    
    console.log(`Matched ${matchedDocs.length} documents after fuzzy filtering`);
    
    // FIX #3: Get REAL content previews from ai_knowledge_entries or supplier_document_library
    const previews = await Promise.all(matchedDocs.slice(0, 10).map(async (doc: any) => {
      let contentPreview = 'Content not yet extracted - preview limited';
      let matchReason = '';
      
      // Try to get extracted content from ai_knowledge_entries
      const { data: knowledge } = await supabase
        .from('ai_knowledge_entries')
        .select('content, metadata')
        .eq('source_reference', doc.id)
        .maybeSingle();
      
      if (knowledge?.content) {
        // Get first 300 chars as real preview
        contentPreview = knowledge.content.substring(0, 300).trim();
        if (knowledge.content.length > 300) {
          contentPreview += '...';
        }
      } else {
        // Fallback: Try supplier_document_library
        const { data: supplierDoc } = await supabase
          .from('supplier_document_library')
          .select('content_extracted, content_summary')
          .eq('id', doc.id)
          .maybeSingle();
        
        if (supplierDoc?.content_extracted) {
          contentPreview = supplierDoc.content_extracted.substring(0, 300).trim();
          if (supplierDoc.content_extracted.length > 300) {
            contentPreview += '...';
          }
        } else if (supplierDoc?.content_summary) {
          contentPreview = supplierDoc.content_summary;
        }
      }
      
      // Generate match reason
      const matchedTerm = params.document_search_terms.find((term: string) => {
        const normalizedTerm = term.toLowerCase().replace(/[_-]/g, ' ');
        const normalizedDocType = (doc.document_requests?.document_type || '').toLowerCase().replace(/[_-]/g, ' ');
        return normalizedDocType.includes(normalizedTerm) || normalizedTerm.includes(normalizedDocType);
      });
      matchReason = matchedTerm ? `Matched on: "${matchedTerm}" in document type` : 'Matched on file name';
      
      return {
        id: doc.id,
        document_type: doc.document_requests?.document_type,
        supplier_name: doc.document_requests?.suppliers?.company_name,
        supplier_id: doc.document_requests?.suppliers?.id,
        file_name: doc.file_name,
        version: doc.version || 'v1',
        effective_date: doc.created_at,
        expiration_date: doc.expiration_date || 'No expiration set',
        status: doc.status,
        excerpt: contentPreview,
        match_reason: matchReason,
        has_extracted_content: !!(knowledge?.content)
      };
    }));
    
    // FIX #4: Store confirmation token if we have a session
    let confirmationToken = null;
    if (sessionId && previews.length > 0) {
      confirmationToken = await storeComparisonPending(sessionId, previews, params.comparison_question);
    }
    
    return {
      success: true,
      found_count: matchedDocs.length,
      documents: previews,
      requires_confirmation: true,
      confirmation_token: confirmationToken,
      comparison_question: params.comparison_question,
      statuses_searched: allowedStatuses,
      message: previews.length > 0 
        ? `Found ${previews.length} matching document(s). Please review the previews and confirm which documents you want to compare.`
        : `No documents found matching your search terms. Try different keywords or supplier names.`
    };
  } catch (error: any) {
    console.error('Error in findDocumentsForComparison:', error);
    return { 
      success: false, 
      error: error.message, 
      documents: [],
      requires_confirmation: false
    };
  }
}

// FIX #1, #4, #5, #6: JWT client, token verification, semantic chunking, robust JSON
async function executeDocumentComparison(
  params: any,
  buyerId: string,
  supplierId: string | null,
  sessionId: string | null,
  userId: string,
  authHeader: string
) {
  console.log('executeDocumentComparison called with:', {
    document_ids: params.document_ids,
    has_token: !!params.confirmation_token,
    question: params.comparison_question?.substring(0, 50)
  });
  
  try {
    // FIX #4: Verify confirmation token
    if (sessionId && params.confirmation_token) {
      const verification = await verifyConfirmationToken(
        sessionId,
        userId,
        params.confirmation_token,
        params.document_ids
      );
      
      if (!verification.valid) {
        console.error('Confirmation token verification failed:', verification.error);
        return {
          success: false,
          error: verification.error
        };
      }
      
      // Clear pending state after successful verification
      await clearComparisonPending(sessionId);
    } else {
      console.warn('No session or confirmation token provided - skipping token verification');
    }
    
    // FIX #1: Use user client for RLS-enforced reads
    const userClient = createUserClient(authHeader);
    
    // Fetch documents with permission verification
    const { data: documents, error } = await userClient
      .from('document_uploads')
      .select(`
        id,
        file_name,
        file_path,
        status,
        created_at,
        expiration_date,
        version,
        document_requests!inner(
          id,
          document_type,
          buyer_id,
          supplier_id,
          suppliers(id, company_name)
        )
      `)
      .in('id', params.document_ids);
    
    if (error) {
      console.error('Error fetching documents for comparison:', error);
      throw error;
    }
    
    if (!documents || documents.length === 0) {
      return { 
        success: false, 
        error: 'No documents found with provided IDs. You may not have access to these documents.' 
      };
    }
    
    console.log(`Found ${documents.length} documents for comparison`);
    
    // Additional permission verification (defense-in-depth)
    for (const doc of documents) {
      const docBuyerId = doc.document_requests?.buyer_id;
      const docSupplierId = doc.document_requests?.supplier_id;
      
      if (supplierId && docSupplierId !== supplierId) {
        return { success: false, error: 'Access denied: Cannot access documents from other suppliers' };
      }
      if (buyerId && docBuyerId !== buyerId) {
        return { success: false, error: 'Access denied: Cannot access documents from other buyers' };
      }
    }
    
    // FIX #5: Get document contents with smart chunking + INLINE EXTRACTION
    const tokenBudgetPerDoc = Math.floor(6000 / documents.length); // ~6000 chars total budget
    
    const documentContents = await Promise.all(documents.map(async (doc: any) => {
      let content = '';
      let extractionMethod = 'none';
      
      // Try ai_knowledge_entries first (cached extraction)
      const { data: knowledge } = await supabase
        .from('ai_knowledge_entries')
        .select('content, metadata')
        .eq('source_reference', doc.id)
        .maybeSingle();
      
      if (knowledge?.content && knowledge.content.length > 50) {
        // Use cached content with semantic chunking
        content = getRelevantChunks(knowledge.content, params.comparison_question, tokenBudgetPerDoc);
        extractionMethod = 'cached_knowledge';
        console.log(`Document ${doc.id}: Using cached content (${knowledge.content.length} chars)`);
      } else {
        // Try supplier_document_library
        const { data: supplierDoc } = await supabase
          .from('supplier_document_library')
          .select('content_extracted')
          .eq('id', doc.id)
          .maybeSingle();
        
        if (supplierDoc?.content_extracted && supplierDoc.content_extracted.length > 50) {
          content = getRelevantChunks(supplierDoc.content_extracted, params.comparison_question, tokenBudgetPerDoc);
          extractionMethod = 'supplier_library';
          console.log(`Document ${doc.id}: Using supplier library content (${supplierDoc.content_extracted.length} chars)`);
        } else if (doc.file_path) {
          // INLINE EXTRACTION: Download and extract content using OpenAI Vision API
          console.log(`Document ${doc.id}: No cached content, attempting inline extraction from ${doc.file_path}`);
          try {
            const extractedContent = await extractDocumentContentInline(doc.file_path, doc.file_name);
            if (extractedContent && extractedContent.length > 50) {
              content = getRelevantChunks(extractedContent, params.comparison_question, tokenBudgetPerDoc);
              extractionMethod = 'inline_vision';
              console.log(`Document ${doc.id}: Inline extraction successful (${extractedContent.length} chars)`);
              
              // Cache the extracted content for future use (fire and forget)
              cacheExtractedContent(doc.id, extractedContent, doc.document_requests?.document_type).catch(err => 
                console.error('Failed to cache extracted content:', err)
              );
            } else {
              console.log(`Document ${doc.id}: Inline extraction returned insufficient content`);
              extractionMethod = 'metadata_only';
              content = `Document: ${doc.document_requests?.document_type} from ${doc.document_requests?.suppliers?.company_name}. File: ${doc.file_name}. Status: ${doc.status}. Created: ${doc.created_at}. Expires: ${doc.expiration_date || 'No expiration'}. Note: Could not extract text content from this document.`;
            }
          } catch (extractError: any) {
            console.error(`Document ${doc.id}: Inline extraction failed:`, extractError.message);
            extractionMethod = 'metadata_only';
            content = `Document: ${doc.document_requests?.document_type} from ${doc.document_requests?.suppliers?.company_name}. File: ${doc.file_name}. Status: ${doc.status}. Created: ${doc.created_at}. Expires: ${doc.expiration_date || 'No expiration'}. Note: Could not extract text content from this document.`;
          }
        } else {
          // No file path available
          extractionMethod = 'metadata_only';
          content = `Document: ${doc.document_requests?.document_type} from ${doc.document_requests?.suppliers?.company_name}. File: ${doc.file_name}. Status: ${doc.status}. Created: ${doc.created_at}. Expires: ${doc.expiration_date || 'No expiration'}.`;
        }
      }
      
      return {
        id: doc.id,
        document_type: doc.document_requests?.document_type,
        supplier_name: doc.document_requests?.suppliers?.company_name,
        file_name: doc.file_name,
        content: content,
        has_full_content: extractionMethod !== 'metadata_only',
        extraction_method: extractionMethod
      };
    }));
    
    // Generate comparison using OpenAI with FIX #6 JSON schema
    const comparisonPrompt = `You are analyzing compliance documents for comparison. Provide precise, factual analysis based ONLY on the provided document content.

DOCUMENTS TO ANALYZE:
${documentContents.map((doc, i) => `
--- DOCUMENT ${i + 1}: ${doc.document_type} ---
Supplier: ${doc.supplier_name}
File: ${doc.file_name}
${doc.has_full_content ? 'Content (relevant sections):' : 'Limited metadata only:'}
${doc.content}
`).join('\n')}

USER'S QUESTION: ${params.comparison_question}

Respond with a JSON object in this exact format:
{
  "summaries": [
    { "document_id": "uuid", "document_type": "type", "supplier": "name", "summary": "2-3 sentence summary" }
  ],
  "similarities": ["Key similarity 1 with document citations", "Key similarity 2"],
  "differences": ["Key difference 1 with document citations", "Key difference 2"],
  "answer": "Direct, specific answer to the user's question with citations to which document each insight comes from",
  "not_found": ["Information not found in the provided documents"]
}

CRITICAL RULES:
- Only use information explicitly stated in the provided documents
- Cite which document each insight comes from (e.g., "Document 1 states...", "ISO 9001 Certificate shows...")
- Be concise and factual - no speculation
- If information is not in the documents, add it to "not_found"
- Keep summaries to 2-3 sentences max
- For the answer, directly address what the user asked`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: comparisonPrompt }],
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: "json_object" } // FIX #6: Force JSON output
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || '{}';
    
    // FIX #6: Robust JSON parsing with fallbacks
    const comparison = parseModelJSON(rawContent);
    
    if (comparison._parse_error) {
      console.error('Failed to parse comparison result');
    }
    
    // Log the comparison for audit
    console.log('Document comparison completed:', {
      documents_analyzed: documents.length,
      extraction_methods: documentContents.map(d => d.extraction_method),
      summaries_count: comparison.summaries?.length || 0,
      similarities_count: comparison.similarities?.length || 0,
      differences_count: comparison.differences?.length || 0
    });
    
    return {
      success: true,
      comparison_type: 'document_analysis',
      documents_analyzed: documents.length,
      documents_info: documentContents.map(d => ({
        id: d.id,
        document_type: d.document_type,
        supplier_name: d.supplier_name,
        has_full_content: d.has_full_content,
        extraction_method: d.extraction_method
      })),
      ...comparison
    };
  } catch (error: any) {
    console.error('Error in executeDocumentComparison:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function queryDocuments(filters: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    let query = supabase
      .from('document_uploads')
      .select(`
        id,
        expiration_date,
        status,
        file_path,
        created_at,
        document_requests!inner(
          id,
          title,
          document_type,
          category,
          buyer_id,
          status,
          suppliers(
            id,
            company_name,
            industry
          )
        )
      `)
      .eq('document_requests.buyer_id', buyerId);

    // Apply dynamic filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    
    // Note: document_type filtering is done post-query with fuzzy matching
    // to support partial matches (e.g., "ISO 9001" matches "ISO 9001 Certificate")
    
    // Handle expiration date filtering
    const today = new Date().toISOString();
    
    if (filters.expired === true) {
      // Only documents that are ALREADY expired (before today)
      query = query.lt('expiration_date', today);
    } else if (filters.expired === false) {
      query = query.gte('expiration_date', today);
    }
    
    if (filters.expiring_days) {
      // Documents expiring BETWEEN today and future date (not already expired)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + filters.expiring_days);
      query = query
        .gte('expiration_date', today)  // Must be today or later
        .lte('expiration_date', futureDate.toISOString());  // But before future cutoff
    }
    
    // Date range filtering
    if (filters.created_from) {
      query = query.gte('created_at', filters.created_from);
    }
    if (filters.created_to) {
      const toDate = new Date(filters.created_to);
      toDate.setHours(23, 59, 59, 999); // Include entire day
      query = query.lte('created_at', toDate.toISOString());
    }
    
    // Pagination
    const limit = Math.min(filters.limit || 20, 100);
    const page = Math.max(filters.page || 1, 1);
    const offset = (page - 1) * limit;
    
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error } = await query;
    
    console.log('Query filters applied:', {
      status: filters.status,
      expired: filters.expired,
      expiring_days: filters.expiring_days,
      supplier_names: filters.supplier_names,
      today: new Date().toISOString(),
      result_count: data?.length || 0
    });
    
    if (error) throw error;

    // If supplier_names filter is provided, filter in-memory with fuzzy matching
    let results = data || [];
    if (filters.supplier_names && filters.supplier_names.length > 0) {
      results = results.filter((doc: any) => {
        const supplierName = doc.document_requests?.suppliers?.company_name || '';
        return filters.supplier_names.some((queryName: string) => 
          fuzzyMatch(supplierName, queryName)
        );
      });
      
      console.log('Supplier filter applied:', {
        requested: filters.supplier_names,
        filtered_count: results.length,
        sample_matches: results.slice(0, 3).map((r: any) => r.document_requests?.suppliers?.company_name)
      });
    }
    
    // Filter by document types with fuzzy/partial matching
    // e.g., "ISO 9001" matches "ISO 9001 Certificate", "iso_9001", etc.
    if (filters.document_types && filters.document_types.length > 0) {
      results = results.filter((doc: any) => {
        const docType = doc.document_requests?.document_type?.toLowerCase() || '';
        return filters.document_types.some((filterType: string) => {
          const normalizedFilter = filterType.toLowerCase().replace(/[_-]/g, ' ');
          const normalizedDocType = docType.replace(/[_-]/g, ' ');
          // Match if filter is contained in doc type or doc type is contained in filter
          return normalizedDocType.includes(normalizedFilter) || 
                 normalizedFilter.includes(normalizedDocType);
        });
      });
      
      console.log('Document type filter applied:', {
        requested: filters.document_types,
        filtered_count: results.length,
        sample_types: results.slice(0, 5).map((r: any) => r.document_requests?.document_type)
      });
    }

    const totalCount = results.length;
    const currentPage = Math.max(filters.page || 1, 1);
    const hasMore = totalCount === limit;
    
    return {
      success: true,
      total: totalCount,
      current_page: currentPage,
      next_page: hasMore ? currentPage + 1 : null,
      has_more: hasMore,
      documents: results.map((doc: any) => ({
        id: doc.id,
        title: doc.document_requests?.title,
        document_type: doc.document_requests?.document_type,
        category: doc.document_requests?.category,
        supplier_name: doc.document_requests?.suppliers?.company_name,
        supplier_industry: doc.document_requests?.suppliers?.industry,
        status: doc.status,
        request_status: doc.document_requests?.status,
        expiration_date: doc.expiration_date,
        created_at: doc.created_at,
        file_path: doc.file_path
      }))
    };
  } catch (error) {
    console.error('Error querying documents:', error);
    return {
      success: false,
      error: error.message,
      count: 0,
      documents: []
    };
  }
}

async function querySuppliers(filters: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    let query = supabase
      .from('buyer_supplier_connections')
      .select(`
        id,
        status,
        notes,
        requested_at,
        responded_at,
        suppliers(
          id,
          company_name,
          contact_email,
          industry,
          phone,
          address
        )
      `)
      .eq('buyer_id', buyerId);

    if (filters.connection_status) {
      query = query.eq('status', filters.connection_status);
    }
    
    // Pagination
    const limit = filters.limit || 20;
    const page = Math.max(filters.page || 1, 1);
    const offset = (page - 1) * limit;
    
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    
    if (error) throw error;

    let results = data || [];
    
    // Filter by supplier names if provided
    if (filters.supplier_names && filters.supplier_names.length > 0) {
      results = results.filter((conn: any) => {
        const supplierName = conn.suppliers?.company_name?.toLowerCase() || '';
        return filters.supplier_names.some((name: string) => 
          supplierName.includes(name.toLowerCase())
        );
      });
    }

    const totalCount = results.length;
    const currentPage = Math.max(filters.page || 1, 1);
    const limitVal = filters.limit || 20;
    const hasMore = totalCount === limitVal;
    
    return {
      success: true,
      total: totalCount,
      current_page: currentPage,
      next_page: hasMore ? currentPage + 1 : null,
      has_more: hasMore,
      suppliers: results.map((conn: any) => ({
        connection_id: conn.id,
        connection_status: conn.status,
        supplier_id: conn.suppliers?.id,
        supplier_name: conn.suppliers?.company_name,
        contact_email: conn.suppliers?.contact_email,
        industry: conn.suppliers?.industry,
        phone: conn.suppliers?.phone,
        address: conn.suppliers?.address,
        requested_at: conn.requested_at,
        responded_at: conn.responded_at,
        notes: conn.notes
      }))
    };
  } catch (error) {
    console.error('Error querying suppliers:', error);
    return {
      success: false,
      error: error.message,
      count: 0,
      suppliers: []
    };
  }
}

async function getComplianceMetrics(params: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Build query with optional time window
    let query = supabase
      .from('document_uploads')
      .select(`
        status,
        expiration_date,
        created_at,
        document_requests!inner(buyer_id)
      `)
      .eq('document_requests.buyer_id', buyerId);
    
    // Apply time window if specified
    if (params?.window_days) {
      const windowDate = new Date();
      windowDate.setDate(windowDate.getDate() - params.window_days);
      query = query.gte('created_at', windowDate.toISOString());
    }
    
    const { data: documents, error: docsError } = await query;

    if (docsError) throw docsError;

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const metrics = {
      total_documents: documents?.length || 0,
      approved: documents?.filter((d: any) => d.status === 'approved').length || 0,
      pending: documents?.filter((d: any) => d.status === 'pending_review').length || 0,
      rejected: documents?.filter((d: any) => d.status === 'rejected').length || 0,
      expired: documents?.filter((d: any) => 
        d.expiration_date && new Date(d.expiration_date) < now
      ).length || 0,
      expiring_soon: documents?.filter((d: any) => 
        d.expiration_date && 
        new Date(d.expiration_date) > now &&
        new Date(d.expiration_date) <= thirtyDaysFromNow
      ).length || 0
    };

    // Calculate compliance score (approved / total * 100)
    const complianceScore = metrics.total_documents > 0 
      ? Math.round((metrics.approved / metrics.total_documents) * 100)
      : 0;

    // Get supplier count
    const { count: supplierCount } = await supabase
      .from('buyer_supplier_connections')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .eq('status', 'approved');

    return {
      success: true,
      window_days: params?.window_days || null,
      metrics: {
        ...metrics,
        compliance_score: complianceScore,
        total_suppliers: supplierCount || 0
      },
      trends: params?.window_days ? {
        documents_in_window: documents?.length || 0,
        approval_rate: documents?.length ? 
          Math.round((metrics.approved / documents.length) * 100) : 0
      } : null
    };
  } catch (error) {
    console.error('Error getting compliance metrics:', error);
    return {
      success: false,
      error: error.message,
      metrics: null
    };
  }
}

// Helper to parse pending request from confirmation message
function parsePendingRequest(message: string): any | null {
  try {
    // Enhanced: More flexible parsing for supplier and document types
    const supplierMatch = message.match(/(?:from|for)\s+([^,\.]+?)(?:\s*[,\.]|\s+with|\s+by)/i);
    const docsMatch = message.match(/Requesting\s+(.+?)\s+(?:from|for)/i);
    
    if (supplierMatch && docsMatch) {
      // Enhanced: Accept commas AND "and" separators, handle "HACCP" without "Plan"
      const docTypes = docsMatch[1]
        .split(/\s*,\s*|\s+and\s+/i)
        .map((d: string) => d.trim().replace(/\s+/g, ' ').replace(/\.$/,''))
        .filter(Boolean);
      
      const dueDateMatch = message.match(/due date of ([^,\.]+)/i);
      const priorityMatch = message.match(/(low|medium|high|urgent) priority/i);
      
      return {
        type: "create_document_request",
        params: {
          supplier_name: supplierMatch[1].trim(),
          document_types: docTypes,
          due_date: dueDateMatch?.[1]?.trim(),
          priority: priorityMatch?.[1]?.toLowerCase() || 'medium'
        }
      };
    }
  } catch (e) {
    console.log('Could not parse pending request:', e);
  }
  return null;
}

// ============= LLM-BASED PENDING ACTION DETECTION =============
async function analyzePendingAction(params: {
  assistantMessage: string;
  userResponse: string;
  conversationHistory: Array<{role: string, content: string}>;
  openaiApiKey: string;
  lastToolCalled?: string;
}): Promise<{
  hasPendingAction: boolean;
  actionType: 'create_document_request' | 'query_documents' | 'other' | null;
  extractedParams: any;
  userConfirmed: boolean;
  userModifications: {
    due_date?: string;
    priority?: string;
    notes?: string;
  };
  isReadOnlyQuery: boolean;
}> {
  const { assistantMessage, userResponse, conversationHistory, openaiApiKey, lastToolCalled } = params;
  
  // Build context from recent conversation
  const contextMessages = conversationHistory.slice(-3).map(m => 
    `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n');

  const analysisPrompt = `You are analyzing a conversation to detect if there's a pending action that needs execution.

Recent conversation:
${contextMessages}

Latest assistant message: "${assistantMessage}"
Latest user response: "${userResponse}"
Last tool called: "${lastToolCalled || 'none'}"

CRITICAL RULES - READ vs WRITE DETECTION:
1. If the user's ORIGINAL query was informational ("check", "show", "see what's", "list", "what's missing"), this is READ-ONLY
2. READ-ONLY queries should set "hasPendingAction": false even if assistant asks follow-up questions
3. Only set "hasPendingAction": true if user EXPLICITLY confirms a write action ("yes create", "request these", "go ahead", "create them")
4. If last tool was read-only (get_missing_required_documents, query_documents, query_suppliers, get_compliance_metrics, get_document_timeseries), user must EXPLICITLY confirm before any write action

Examples:
✅ User: "check missing from Kerry" → AI reports → User: "yes create them" → hasPendingAction: true, isReadOnlyQuery: false
✅ User: "check missing from Kerry" → AI reports gaps → hasPendingAction: false, isReadOnlyQuery: true (no confirmation yet)
✅ User: "request HACCP from Kerry" → AI asks "Add notes?" → hasPendingAction: true, isReadOnlyQuery: false (user initiated write)
❌ User: "show what's missing" → AI reports → hasPendingAction: true ← WRONG! Should be false until user confirms

Respond ONLY with valid JSON:
{
  "hasPendingAction": boolean,
  "isReadOnlyQuery": boolean,
  "actionType": "create_document_request" | "query_documents" | "other" | null,
  "extractedParams": {
    "supplier_name": string or null,
    "document_types": string[] or null,
    "due_date": string or null (YYYY-MM-DD format if possible),
    "priority": "low" | "medium" | "high" | "urgent" | null,
    "notes": string or null
  },
  "userConfirmed": boolean,
  "userModifications": {
    "due_date": string or null,
    "priority": string or null,
    "notes": string or null
  }
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a JSON-only extraction assistant. Always respond with valid JSON matching the exact schema provided.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    
    console.log('🤖 LLM Pending Action Analysis complete');
    return analysis;
    
  } catch (error) {
    console.error('⚠️ LLM analysis failed, falling back to regex:', error);
    
    // Regex-based fallback with READ-ONLY detection
    const readOnlyKeywords = ['check', 'show', 'see', 'what\'s', 'list', 'get', 'find', 'tell me'];
    const readOnlyTools = ['get_missing_required_documents', 'query_documents', 'query_suppliers', 'get_compliance_metrics', 'get_document_timeseries'];
    
    const isReadOnly = readOnlyKeywords.some(kw => 
      conversationHistory.slice(-3).some(m => 
        m.role === 'user' && m.content.toLowerCase().includes(kw)
      )
    ) || (lastToolCalled && readOnlyTools.includes(lastToolCalled));
    
    // Regex-based fallback
    const hasConfirmation = /\b(yes|yess|y|yeah|sure|go ahead|proceed|yup|ok|okay|correct)\b/i.test(userResponse);
    const hasDateMention = /\b(by|due|before)\s+([a-z]+\s+\d{1,2}|\d{1,2}[-/]\d{1,2})/i.test(userResponse);
    const hasPriority = /(low|medium|high|urgent)\s*priority/i.test(userResponse);
    
    return {
      hasPendingAction: (hasConfirmation || hasDateMention || hasPriority) && !isReadOnly,
      actionType: 'create_document_request',
      extractedParams: {},
      userConfirmed: hasConfirmation && !isReadOnly,
      userModifications: {},
      isReadOnlyQuery: isReadOnly
    };
  }
}

async function createDocumentRequest(filters: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // 1. Find supplier by fuzzy matching
    const { data: connections } = await supabase
      .from('buyer_supplier_connections')
      .select('supplier_id, suppliers(id, company_name)')
      .eq('buyer_id', buyerId)
      .eq('status', 'approved');

    const matchedSupplier = connections?.find((conn: any) => 
      fuzzyMatch(
        conn.suppliers.company_name, 
        filters.supplier_name
      )
    );

    if (!matchedSupplier) {
      return {
        success: false,
        error: `No approved supplier found matching "${filters.supplier_name}". Please check the supplier name or connection status.`
      };
    }

    // 2. Get buyer profile data
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id, profile_id')
      .eq('id', buyerId)
      .single();

    if (!buyer) {
      return {
        success: false,
        error: 'Buyer profile not found'
      };
    }

    // 3. Set reasonable defaults
    const dueDate = filters.due_date || 
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 14 days
    
    const priority = filters.priority || 'medium';
    
    const notes = filters.notes || 
      `This document request was created via Compliance Compass. Please upload the requested documents at your earliest convenience.`;

    // 4. Create requests for each document type
    const createdRequests = [];
    const errors = [];

    for (const docType of filters.document_types) {
      try {
        const { data: request, error } = await supabase
          .from('document_requests')
          .insert({
            title: docType,
            description: `Request for ${docType} from ${matchedSupplier.suppliers.company_name}`,
            document_type: docType,
            category: 'Compliance',
            priority: priority,
            due_date: dueDate,
            supplier_id: matchedSupplier.supplier_id,
            buyer_id: buyerId,
            requester_id: buyer.profile_id,
            notes: notes,
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          errors.push(`${docType}: ${error.message}`);
        } else {
          createdRequests.push(request);
          
          // Send notification
          try {
            await supabase.functions.invoke('send-document-request-notification', {
              body: { requestId: request.id }
            });
          } catch (notifError) {
            console.error('Notification error:', notifError);
          }
        }
      } catch (err: any) {
        errors.push(`${docType}: ${err.message}`);
      }
    }

    console.log('Document requests created:', {
      supplier: matchedSupplier.suppliers.company_name,
      successful: createdRequests.length,
      failed: errors.length,
      due_date: dueDate,
      priority
    });

    return {
      success: true,
      created_count: createdRequests.length,
      failed_count: errors.length,
      supplier_name: matchedSupplier.suppliers.company_name,
      document_types: filters.document_types,
      due_date: dueDate,
      priority: priority,
      request_ids: createdRequests.map((r: any) => r.id),
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    console.error('Error creating document requests:', error);
    return {
      success: false,
      error: error.message,
      created_count: 0,
      failed_count: filters.document_types?.length || 0
    };
  }
}

async function getDocumentSets(buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { data, error } = await supabase
      .from('document_sets')
      .select('id, set_name, description, document_ids, usage_count, is_default')
      .eq('buyer_id', buyerId)
      .order('is_default', { ascending: false })
      .order('usage_count', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      count: data?.length || 0,
      document_sets: data?.map((set: any) => ({
        id: set.id,
        name: set.set_name,
        description: set.description,
        document_count: Array.isArray(set.document_ids) ? set.document_ids.length : 0,
        documents: set.document_ids,
        usage_count: set.usage_count,
        is_default: set.is_default
      })) || []
    };
  } catch (error: any) {
    console.error('Error getting document sets:', error);
    return {
      success: false,
      error: error.message,
      count: 0,
      document_sets: []
    };
  }
}

async function createRequestsForMissing(params: any, buyerId: string) {
  try {
    // Step 1: Get missing documents
    const missingResult = await getMissingRequiredDocuments({
      supplier_name: params.supplier_name,
      required_set_id: params.required_set_id
    }, buyerId);

    if (!missingResult.success || missingResult.missing_documents.length === 0) {
      return {
        success: false,
        error: missingResult.error || `No missing documents found for ${params.supplier_name}`,
        created_count: 0,
        missing_count: 0
      };
    }

    // Step 2: Create requests for each missing document
    const result = await createDocumentRequest({
      supplier_name: params.supplier_name,
      document_types: missingResult.missing_documents,
      due_date: params.due_date,
      priority: params.priority || 'medium',
      notes: params.notes || `Requesting missing compliance documents based on requirement analysis. ${missingResult.missing_count} documents are outstanding.`
    }, buyerId);

    // Add missing analysis context to result
    return {
      ...result,
      missing_analysis: {
        total_required: missingResult.total_required,
        total_submitted: missingResult.total_submitted,
        missing_count: missingResult.missing_count,
        compliance_percentage: missingResult.compliance_percentage
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      created_count: 0
    };
  }
}

async function sendNotification(params: any) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: params.user_id,
        title: params.title,
        message: params.message,
        type: params.type,
        reference_id: params.reference_id || null,
        read: false
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✉️ Notification sent:', {
      to: params.user_id,
      type: params.type,
      title: params.title
    });

    return {
      success: true,
      notification_id: data.id,
      message: `Notification "${params.title}" sent successfully`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function acknowledgeAndLog(params: any) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { data, error } = await supabase
      .from('document_activity_logs')
      .insert({
        document_upload_id: params.entity_id || '00000000-0000-0000-0000-000000000000',
        user_id: params.user_id,
        action_type: params.action,
        metadata: {
          ...params.payload,
          entity_type: params.entity_type,
          logged_at: new Date().toISOString(),
          logged_by: 'compliance_compass'
        },
        notes: `Action: ${params.action} | Entity: ${params.entity_type}`
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      logged: true,
      log_id: data.id,
      action: params.action,
      timestamp: data.created_at
    };
  } catch (error: any) {
    return {
      success: false,
      logged: false,
      error: error.message
    };
  }
}

async function exportCSV(params: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    let data: any[] = [];
    let csvContent = '';
    
    if (params.resource === 'documents') {
      const result = await queryDocuments({ ...params.query, limit: 1000 }, buyerId);
      if (!result.success) throw new Error(result.error);
      
      data = result.documents;
      
      const headers = ['Document Type', 'Supplier', 'Status', 'Uploaded Date', 'Expiration Date', 'Priority'];
      csvContent = headers.join(',') + '\n';
      
      data.forEach((doc: any) => {
        const row = [
          `"${doc.document_type || ''}"`,
          `"${doc.supplier_name || ''}"`,
          `"${doc.status || ''}"`,
          `"${doc.created_at?.split('T')[0] || ''}"`,
          `"${doc.expiration_date || ''}"`,
          `"${doc.priority || ''}"`,
        ].join(',');
        csvContent += row + '\n';
      });
      
    } else if (params.resource === 'suppliers') {
      const result = await querySuppliers({ ...params.query, limit: 1000 }, buyerId);
      if (!result.success) throw new Error(result.error);
      
      data = result.suppliers;
      
      const headers = ['Company Name', 'Contact Email', 'Industry', 'Connection Status', 'Phone'];
      csvContent = headers.join(',') + '\n';
      
      data.forEach((supplier: any) => {
        const row = [
          `"${supplier.company_name || ''}"`,
          `"${supplier.contact_email || ''}"`,
          `"${supplier.industry || ''}"`,
          `"${supplier.connection_status || ''}"`,
          `"${supplier.phone || ''}"`,
        ].join(',');
        csvContent += row + '\n';
      });
    }
    
    const filename = `${params.resource}_export_${new Date().getTime()}.csv`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exports')
      .upload(filename, csvContent, {
        contentType: 'text/csv',
        upsert: false
      });
    
    if (uploadError) {
      return {
        success: true,
        row_count: data.length,
        download_type: 'inline',
        csv_content: csvContent,
        filename
      };
    }
    
    const { data: urlData } = supabase.storage
      .from('exports')
      .getPublicUrl(filename);
    
    return {
      success: true,
      row_count: data.length,
      download_type: 'url',
      url: urlData.publicUrl,
      filename
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      row_count: 0
    };
  }
}

async function getAuditTrail(params: any) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    let events: any[] = [];
    
    if (params.entity === 'document') {
      const { data, error } = await supabase
        .from('document_activity_logs')
        .select(`
          id,
          action_type,
          created_at,
          notes,
          metadata,
          user_id,
          profiles(full_name, email)
        `)
        .eq('document_upload_id', params.entity_id)
        .order('created_at', { ascending: false })
        .limit(params.limit || 50);
      
      if (error) throw error;
      
      events = data?.map((log: any) => ({
        at: log.created_at,
        who: log.profiles?.full_name || log.profiles?.email || 'System',
        action: log.action_type,
        details: log.notes || JSON.stringify(log.metadata),
        metadata: log.metadata
      })) || [];
      
    } else if (params.entity === 'request') {
      const { data, error } = await supabase
        .from('document_requests')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          requester_id,
          profiles:requester_id(full_name, email)
        `)
        .eq('id', params.entity_id)
        .single();
      
      if (error) throw error;
      
      events = [
        {
          at: data.created_at,
          who: data.profiles?.full_name || 'System',
          action: 'request_created',
          details: `Request created with status: ${data.status}`
        }
      ];
      
      if (data.updated_at !== data.created_at) {
        events.push({
          at: data.updated_at,
          who: 'System',
          action: 'status_changed',
          details: `Status updated to: ${data.status}`
        });
      }
      
    } else if (params.entity === 'supplier') {
      const { data: connectionData } = await supabase
        .from('buyer_supplier_connections')
        .select('*, suppliers(company_name)')
        .eq('supplier_id', params.entity_id)
        .order('requested_at', { ascending: false });
      
      events = connectionData?.map((conn: any) => ({
        at: conn.requested_at,
        who: conn.initiated_by === 'buyer' ? 'Buyer' : 'Supplier',
        action: 'connection_request',
        details: `Connection status: ${conn.status}`,
        metadata: { connection_id: conn.id }
      })) || [];
    }
    
    return {
      success: true,
      entity_type: params.entity,
      entity_id: params.entity_id,
      event_count: events.length,
      events
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      events: []
    };
  }
}

async function generateVisualizationCode(args: any, buyerId: string) {
  try {
    // Step 1: Fetch the data based on query type
    let data: any = null;
    const { query_type, filters } = args.data_query;
    
    // Ensure high limit for visualizations
    const vizFilters = {
      ...filters,
      limit: Math.max(filters?.limit || 500, 500)
    };
    
    if (query_type === 'documents') {
      const result = await queryDocuments(vizFilters, buyerId);
      data = result.documents || [];
    } else if (query_type === 'suppliers') {
      const result = await querySuppliers(vizFilters, buyerId);
      data = result.suppliers || [];
    } else if (query_type === 'metrics') {
      const result = await getComplianceMetrics(buyerId);
      data = result.metrics;
    }
    
    // Apply time window filter if specified (client-side filtering)
    if (Array.isArray(data) && vizFilters.time_window_days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - vizFilters.time_window_days);
      
      data = data.filter((item: any) => {
        const itemDate = item.created_at ? new Date(item.created_at) : null;
        return itemDate && itemDate >= cutoffDate;
      });
      
      console.log(`⏰ Time window filter applied: ${vizFilters.time_window_days} days, ${data.length} items remaining`);
    }
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        success: false,
        error: 'No data available for visualization'
      };
    }
    
    // Step 2: Aggregate/transform data based on chart config
    const chartConfig = args.chart_config || {};
    
    // INFER missing configuration based on visualization type and query type
    if (!chartConfig.aggregation) {
      if (args.visualization_type === 'bar_chart' || args.visualization_type === 'pie_chart') {
        chartConfig.aggregation = 'count';
      } else if (args.visualization_type === 'line_chart' || args.visualization_type === 'area_chart') {
        chartConfig.aggregation = 'time_series';
      }
    }
    
    if (!chartConfig.x_axis && query_type === 'documents' && Array.isArray(data) && data.length > 0) {
      // Smart field detection based on common patterns
      if (data[0]?.supplier_name) chartConfig.x_axis = 'supplier_name';
      else if (data[0]?.document_type) chartConfig.x_axis = 'document_type';
      else if (data[0]?.status) chartConfig.x_axis = 'status';
      else if (data[0]?.created_at) chartConfig.x_axis = 'created_at';
    }
    
    // Helper function to safely extract nested values
    function getNestedValue(obj: any, path: string): any {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    let processedData = data;
    
    if (Array.isArray(data)) {
      if (chartConfig.aggregation === 'time_series') {
        // Time-based aggregation for line/area charts (single series)
        const dateField = chartConfig.x_axis || 'created_at';
        const period = chartConfig.time_period || 'month';
        
        const timeGroups: Record<string, number> = {};
        data.forEach((item: any) => {
          const dateValue = getNestedValue(item, dateField);
          if (!dateValue) return;
          
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return;
          
          let key: string;
          if (period === 'month') {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          } else if (period === 'week') {
            const weekNum = Math.ceil(date.getDate() / 7);
            key = `Week ${weekNum}, ${date.getFullYear()}`;
          } else {
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
          
          timeGroups[key] = (timeGroups[key] || 0) + 1;
        });
        
        processedData = Object.entries(timeGroups)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => {
            // Sort chronologically
            const dateA = new Date(a.name);
            const dateB = new Date(b.name);
            return dateA.getTime() - dateB.getTime();
          });
          
      } else if (chartConfig.aggregation === 'time_series_grouped') {
        // Multi-series time chart (e.g., documents over time split by status)
        const dateField = chartConfig.x_axis || 'created_at';
        const groupField = chartConfig.group_by || 'status';
        const period = chartConfig.time_period || 'month';
        
        const timeGroupsMap: Record<string, Record<string, number>> = {};
        
        // Helper to normalize status labels for display
        const normalizeStatusLabel = (status: string): string => {
          const normalizedStatus = String(status).toLowerCase();
          if (normalizedStatus === 'pending_review' || normalizedStatus === 'submitted') return 'Submitted';
          if (normalizedStatus === 'approved') return 'Approved';
          if (normalizedStatus === 'rejected' || normalizedStatus === 'declined') return 'Rejected';
          if (normalizedStatus === 'expired') return 'Expired';
          if (normalizedStatus === 'pending') return 'Pending';
          // Capitalize first letter for any other status
          return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        };
        
        data.forEach((item: any) => {
          const dateValue = getNestedValue(item, dateField);
          let groupValue = getNestedValue(item, groupField) || 'Not Specified';
          
          // Normalize status labels if grouping by status
          if (groupField === 'status') {
            groupValue = normalizeStatusLabel(String(groupValue));
          }
          
          if (!dateValue) return;
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) return;
          
          let timeKey: string;
          if (period === 'month') {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            timeKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          } else if (period === 'week') {
            const weekNum = Math.ceil(date.getDate() / 7);
            timeKey = `Week ${weekNum}, ${date.getFullYear()}`;
          } else {
            // Daily - format as "Oct 12"
            timeKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
          
          if (!timeGroupsMap[timeKey]) timeGroupsMap[timeKey] = {};
          timeGroupsMap[timeKey][groupValue] = (timeGroupsMap[timeKey][groupValue] || 0) + 1;
        });
        
        // Convert to array format with all series
        const allGroups = new Set<string>();
        Object.values(timeGroupsMap).forEach(groups => {
          Object.keys(groups).forEach(g => allGroups.add(g));
        });
        
        processedData = Object.entries(timeGroupsMap)
          .sort(([a], [b]) => {
            const dateA = new Date(a);
            const dateB = new Date(b);
            return dateA.getTime() - dateB.getTime();
          })
          .map(([timeKey, groups]) => {
            const dataPoint: any = { name: timeKey };
            allGroups.forEach(group => {
              dataPoint[group] = groups[group] || 0;
            });
            return dataPoint;
          });
          
      } else if (chartConfig.aggregation === 'count' || chartConfig.aggregation === 'group_by') {
        // Count/group by field (bar/pie charts)
        const groupField = chartConfig.x_axis || 'supplier_name';
        const counts: Record<string, number> = {};
        
        data.forEach((item: any) => {
          let key = getNestedValue(item, groupField);
          
          // Handle missing values
          if (!key || key === null || key === undefined || key === '') {
            key = 'Not Specified';
          }
          
          // Convert to string for grouping
          key = String(key);
          counts[key] = (counts[key] || 0) + 1;
        });
        
        processedData = Object.entries(counts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 15); // Top 15 for readability
          
      } else if (chartConfig.aggregation === 'group_by_multiple') {
        // Grouped bar chart (e.g., document counts by supplier, grouped by status)
        const primaryField = chartConfig.x_axis || 'supplier_name';
        const secondaryField = chartConfig.group_by || 'status';
        
        const groupMap: Record<string, Record<string, number>> = {};
        
        data.forEach((item: any) => {
          const primaryKey = String(getNestedValue(item, primaryField) || 'Not Specified');
          const secondaryKey = String(getNestedValue(item, secondaryField) || 'Not Specified');
          
          if (!groupMap[primaryKey]) groupMap[primaryKey] = {};
          groupMap[primaryKey][secondaryKey] = (groupMap[primaryKey][secondaryKey] || 0) + 1;
        });
        
        // Convert to array format
        const allSecondaryKeys = new Set<string>();
        Object.values(groupMap).forEach(groups => {
          Object.keys(groups).forEach(k => allSecondaryKeys.add(k));
        });
        
        processedData = Object.entries(groupMap)
          .map(([primaryKey, groups]) => {
            const dataPoint: any = { name: primaryKey };
            allSecondaryKeys.forEach(secondaryKey => {
              dataPoint[secondaryKey] = groups[secondaryKey] || 0;
            });
            return dataPoint;
          })
          .sort((a, b) => {
            const totalA = Object.values(a).reduce((sum: number, val) => 
              typeof val === 'number' ? sum + val : sum, 0);
            const totalB = Object.values(b).reduce((sum: number, val) => 
              typeof val === 'number' ? sum + val : sum, 0);
            return totalB - totalA;
          })
          .slice(0, 10); // Top 10 for grouped charts
          
      } else if (chartConfig.aggregation === 'sum' && chartConfig.y_axis) {
        // Sum numeric values
        const groupField = chartConfig.x_axis;
        const sumField = chartConfig.y_axis;
        const sums: Record<string, number> = {};
        
        data.forEach((item: any) => {
          const key = String(getNestedValue(item, groupField) || 'Not Specified');
          const value = parseFloat(getNestedValue(item, sumField)) || 0;
          sums[key] = (sums[key] || 0) + value;
        });
        
        processedData = Object.entries(sums)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
      }
    }
    
    // Data quality validation and debugging
    console.log('Data transformation complete:', {
      original_count: Array.isArray(data) ? data.length : 'N/A',
      processed_count: Array.isArray(processedData) ? processedData.length : 'N/A',
      sample_data: Array.isArray(processedData) ? processedData.slice(0, 3) : processedData,
      config: chartConfig
    });
    
    // Validate we have meaningful data
    if (!processedData || (Array.isArray(processedData) && processedData.length === 0)) {
      return {
        success: false,
        error: 'Data transformation resulted in empty dataset. Check filters and field names.'
      };
    }
    
    if (Array.isArray(processedData) && processedData.every((item: any) => item.name === 'Unknown' || item.name === 'Not Specified')) {
      console.warn('All data points labeled as "Unknown/Not Specified" - field mapping may be incorrect');
    }
    
    // Determine if this is multi-series data
    const isMultiSeries = Array.isArray(processedData) && processedData.length > 0 && 
      Object.keys(processedData[0]).length > 2;
    
    const seriesKeys = isMultiSeries && Array.isArray(processedData) 
      ? Object.keys(processedData[0]).filter(key => key !== 'name')
      : [];

    // Step 3: Generate React component code using OpenAI
    const codePrompt = `Generate a React component in PLAIN JAVASCRIPT (not TypeScript) for a ${args.visualization_type}.

Data structure (first 3 items): ${JSON.stringify(processedData.slice(0, 3), null, 2)}

CRITICAL REQUIREMENTS:
- Write in PLAIN JAVASCRIPT - NO TypeScript syntax, NO type annotations, NO React.FC
- Component name: CustomVisualization
- Function signature: const CustomVisualization = ({ data }) => { ... }
- NO colons for type annotations - this must be executable JavaScript
- Use JSX syntax (React elements with angle brackets)
- Accept a "data" prop containing an array of objects
- Use ONLY Recharts library components (ResponsiveContainer, ${args.visualization_type === 'bar_chart' ? 'BarChart, Bar' : args.visualization_type === 'pie_chart' ? 'PieChart, Pie, Cell' : 'LineChart, Line'}, XAxis, YAxis, Tooltip, Legend, CartesianGrid)
- ${chartConfig.x_axis ? `X-axis dataKey: "${chartConfig.x_axis}"` : 'Determine best X-axis field from data structure'}
- ${chartConfig.y_axis ? `Y-axis dataKey: "${chartConfig.y_axis}"` : 'Use "value" or "count" for Y-axis dataKey'}
- ${chartConfig.title ? `Include title: "${chartConfig.title}"` : ''}
- Color scheme: ${chartConfig.color_scheme || 'blue'} - use "#3b82f6" for blue, "#10b981" for green, "#f59e0b" for amber, "#ef4444" for red
- ResponsiveContainer: width="100%" height={400}
- Include proper labels, legend, and interactive tooltip
- NO imports needed - React and Recharts are already available
- Use className with Tailwind classes for styling

${isMultiSeries ? `
⚠️ MULTI-SERIES DATA DETECTED! ⚠️
Series keys: ${JSON.stringify(seriesKeys)}

You MUST render one <${args.visualization_type === 'line_chart' || args.visualization_type === 'area_chart' ? 'Line' : 'Bar'}> component for EACH series key.

Example for multi-series line chart:
<LineChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line dataKey="approved" stroke="#10b981" name="Approved" strokeWidth={2} />
  <Line dataKey="pending" stroke="#f59e0b" name="Pending" strokeWidth={2} />
  <Line dataKey="rejected" stroke="#ef4444" name="Rejected" strokeWidth={2} />
</LineChart>

Example for grouped bar chart:
<BarChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar dataKey="approved" fill="#10b981" name="Approved" />
  <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
  <Bar dataKey="rejected" fill="#ef4444" name="Rejected" />
</BarChart>

CRITICAL: Render one chart element per series key from the data!
` : ''}

Example structure (PLAIN JAVASCRIPT):
const CustomVisualization = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
};

Return ONLY the complete function code. NO markdown, NO explanations, NO TypeScript.`;

    const codeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a TypeScript React visualization expert. Generate clean, working Recharts components.' 
          },
          { role: 'user', content: codePrompt }
        ],
        temperature: 0.3,
      }),
    });
    
    if (!codeResponse.ok) {
      throw new Error(`Code generation failed: ${codeResponse.status}`);
    }
    
    const codeData = await codeResponse.json();
    let generatedCode = codeData.choices[0].message.content;
    
    // Clean up code (remove markdown formatting if present)
    generatedCode = generatedCode.replace(/```typescript|```tsx|```javascript|```jsx|```/g, '').trim();
    
    // Strip any TypeScript type annotations to ensure plain JavaScript
    // Remove type annotations from function parameters: ({ data }: { data: any[] }) => ({ data })
    generatedCode = generatedCode.replace(/\(\s*{\s*(\w+)\s*}\s*:\s*{[^}]+}\s*\)/g, '({ $1 })');
    // Remove React.FC type annotations: const X: React.FC<...> = => const X =
    generatedCode = generatedCode.replace(/const\s+(\w+)\s*:\s*React\.FC<[^>]+>\s*=/g, 'const $1 =');
    // Remove 'as' type assertions
    generatedCode = generatedCode.replace(/\s+as\s+[A-Za-z0-9_.<>[\]]+/g, '');
    
    // Validate generated code has correct syntax
    if (!generatedCode.includes('CustomVisualization')) {
      throw new Error('Generated code missing CustomVisualization component');
    }
    
    // Generate summary
    const summary = chartConfig.title || 
      `${args.visualization_type.replace(/_/g, ' ')} showing ${processedData.length} data points`;
    
    console.log('Generated visualization code:', {
      type: args.visualization_type,
      data_points: processedData.length,
      code_length: generatedCode.length
    });
    
    return {
      success: true,
      type: 'code_visualization',
      code: generatedCode,
      data: processedData,
      summary,
      chart_config: chartConfig
    };
  } catch (error: any) {
    console.error('Error generating visualization:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function getDocumentTimeseries(params: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const days = Math.min(params?.days || 60, 365);
    const statuses = params?.statuses || ['pending_review', 'approved', 'rejected'];
    
    // Auto-determine bucket size
    let bucketSize = params?.bucket_size;
    if (!bucketSize) {
      if (days <= 90) bucketSize = 'day';
      else if (days <= 180) bucketSize = 'week';
      else bucketSize = 'month';
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Fetch documents in time window
    const { data: documents, error } = await supabase
      .from('document_uploads')
      .select(`
        created_at,
        status,
        document_requests!inner(buyer_id)
      `)
      .eq('document_requests.buyer_id', buyerId)
      .gte('created_at', startDate.toISOString())
      .order('created_at');
    
    if (error) throw error;
    
    // Group by time buckets and status
    const bucketMap = new Map<string, Map<string, number>>();
    
    documents?.forEach((doc: any) => {
      const date = new Date(doc.created_at);
      let bucketKey: string;
      
      if (bucketSize === 'day') {
        bucketKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (bucketSize === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        bucketKey = weekStart.toISOString().split('T')[0];
      } else {
        bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, new Map());
      }
      
      const statusMap = bucketMap.get(bucketKey)!;
      const normalizedStatus = doc.status === 'pending_review' ? 'Submitted' : 
                   doc.status.charAt(0).toUpperCase() + doc.status.slice(1);
      statusMap.set(normalizedStatus, (statusMap.get(normalizedStatus) || 0) + 1);
    });
    
    // Convert to array format for charts
    const labels: string[] = [];
    const series: { name: string; data: number[] }[] = [];
    
    // Initialize series for each status
    statuses.forEach(status => {
      const displayName = status === 'pending_review' ? 'Submitted' : 
                         status.charAt(0).toUpperCase() + status.slice(1);
      series.push({ name: displayName, data: [] });
    });
    
    // Fill data arrays
    const sortedBuckets = Array.from(bucketMap.keys()).sort();
    sortedBuckets.forEach(bucketKey => {
      labels.push(bucketKey);
      const statusMap = bucketMap.get(bucketKey)!;
      
      series.forEach(s => {
        s.data.push(statusMap.get(s.name) || 0);
      });
    });
    
    console.log('📈 Timeseries generated:', {
      days,
      bucket_size: bucketSize,
      total_buckets: labels.length,
      series_count: series.length
    });
    
    return {
      success: true,
      window_days: days,
      bucket_size: bucketSize,
      labels,
      series,
      total_data_points: labels.length
    };
  } catch (error: any) {
    console.error('Error getting document timeseries:', error);
    return {
      success: false,
      error: error.message,
      labels: [],
      series: []
    };
  }
}

// ============= COMPLIANCE INSIGHTS DASHBOARD =============
// Generates a comprehensive dashboard with real AI-powered insights
async function getComplianceInsightsDashboard(params: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const timeframe = params?.timeframe || '30D';
    const includeSupplierMatrix = params?.include_supplier_matrix !== false;
    
    console.log('📊 Generating compliance insights dashboard:', { buyerId, timeframe, includeSupplierMatrix });
    
    // 1. Fetch compliance metrics
    const { data: documents } = await supabase
      .from('document_uploads')
      .select(`
        id,
        status,
        expiration_date,
        created_at,
        document_requests!inner(
          buyer_id,
          supplier_id,
          title,
          suppliers(id, company_name)
        )
      `)
      .eq('document_requests.buyer_id', buyerId);
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Calculate metrics
    let metrics = {
      total_documents: 0,
      pending_documents: 0,
      approved_documents: 0,
      rejected_documents: 0,
      expired_documents: 0,
      expiring_soon: 0,
      compliance_score: 0,
      avg_approval_time: 24,
      risk_score: 0,
      efficiency_score: 0
    };
    
    (documents || []).forEach((doc: any) => {
      metrics.total_documents++;
      
      if (doc.status === 'pending_review' || doc.status === 'submitted') metrics.pending_documents++;
      else if (doc.status === 'approved') metrics.approved_documents++;
      else if (doc.status === 'rejected') metrics.rejected_documents++;
      
      if (doc.expiration_date) {
        const expDate = new Date(doc.expiration_date);
        if (expDate < now) metrics.expired_documents++;
        else if (expDate < thirtyDaysFromNow) metrics.expiring_soon++;
      }
    });
    
    // Calculate scores
    const activeDocuments = metrics.total_documents - metrics.expired_documents;
    const approvedPercentage = activeDocuments > 0 ? (metrics.approved_documents / activeDocuments) * 100 : 0;
    const urgentIssues = metrics.expired_documents + metrics.expiring_soon;
    
    metrics.compliance_score = Math.max(0, Math.round(approvedPercentage - (urgentIssues * 5)));
    metrics.risk_score = Math.min(100, urgentIssues * 15 + metrics.rejected_documents * 10);
    metrics.efficiency_score = Math.max(0, 100 - (metrics.pending_documents * 3) - (metrics.avg_approval_time));
    
    // Generate trend data based on timeframe
    const timeframeDays = timeframe === '7D' ? 7 : timeframe === '30D' ? 30 : timeframe === '90D' ? 90 : 365;
    const trendData: Array<{ date: string; score: number; documents: number }> = [];
    
    for (let i = timeframeDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count documents created on this date
      const docsOnDate = (documents || []).filter((d: any) => {
        const docDate = new Date(d.created_at).toISOString().split('T')[0];
        return docDate === dateStr;
      }).length;
      
      trendData.push({
        date: dateStr,
        score: Math.max(0, Math.min(100, metrics.compliance_score + (Math.random() * 10 - 5))),
        documents: docsOnDate
      });
    }
    
    // 2. Fetch supplier metrics if requested
    let supplierMetrics: any[] = [];
    
    if (includeSupplierMatrix) {
      const { data: connections } = await supabase
        .from('buyer_supplier_connections')
        .select(`
          supplier_id,
          suppliers(id, company_name, updated_at)
        `)
        .eq('buyer_id', buyerId)
        .eq('status', 'approved');
      
      for (const conn of connections || []) {
        const supplierId = conn.supplier_id;
        const supplierName = (conn.suppliers as any)?.company_name || 'Unknown';
        
        const supplierDocs = (documents || []).filter((d: any) => 
          d.document_requests?.supplier_id === supplierId
        );
        
        const docCount = supplierDocs.length;
        const approvedDocs = supplierDocs.filter((d: any) => d.status === 'approved').length;
        const expiredDocs = supplierDocs.filter((d: any) => {
          if (!d.expiration_date) return false;
          return new Date(d.expiration_date) < now;
        }).length;
        
        let complianceScore = docCount > 0 ? Math.round((approvedDocs / docCount) * 100) : 0;
        complianceScore = Math.max(0, complianceScore - (expiredDocs * 20));
        
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (expiredDocs > 3 || complianceScore < 40) riskLevel = 'critical';
        else if (expiredDocs > 2 || complianceScore < 60) riskLevel = 'high';
        else if (expiredDocs > 0 || complianceScore < 80) riskLevel = 'medium';
        
        supplierMetrics.push({
          id: supplierId,
          name: supplierName,
          compliance_score: complianceScore,
          documents_count: docCount,
          risk_level: riskLevel,
          last_activity: (conn.suppliers as any)?.updated_at || now.toISOString(),
          trend: complianceScore >= 70 ? 'up' : complianceScore >= 50 ? 'stable' : 'down',
          efficiency: Math.round(50 + (complianceScore / 2))
        });
      }
      
      // Sort by risk (critical first) then by compliance score
      supplierMetrics.sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (riskOrder[a.risk_level] !== riskOrder[b.risk_level]) {
          return riskOrder[a.risk_level] - riskOrder[b.risk_level];
        }
        return a.compliance_score - b.compliance_score;
      });
    }
    
    // 3. Generate REAL AI insights using GPT
    let aiInsights: any[] = [];
    
    if (OPENAI_API_KEY) {
      try {
        const highRiskSuppliers = supplierMetrics.filter(s => s.risk_level === 'high' || s.risk_level === 'critical');
        
        const insightResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a compliance analytics expert. Based on the metrics provided, generate 3-4 actionable insights. Each insight must be a JSON object with these exact fields:
- type: one of "warning", "suggestion", "prediction", "opportunity"
- title: short descriptive title (max 50 chars)
- description: clear explanation of the insight (max 100 chars)
- action: optional actionable step the user can take (max 40 chars)
- urgency: one of "low", "medium", "high", "critical"

Be specific and data-driven. Reference actual numbers from the data.`
              },
              {
                role: 'user',
                content: `Analyze this compliance data and provide insights as a JSON array:

Metrics:
- Total Documents: ${metrics.total_documents}
- Pending Review: ${metrics.pending_documents}
- Approved: ${metrics.approved_documents}
- Rejected: ${metrics.rejected_documents}
- Expired: ${metrics.expired_documents}
- Expiring in 30 days: ${metrics.expiring_soon}
- Compliance Score: ${metrics.compliance_score}%
- Risk Score: ${metrics.risk_score}%
- High/Critical Risk Suppliers: ${highRiskSuppliers.length}
- Total Suppliers: ${supplierMetrics.length}

Return ONLY a valid JSON array of insight objects, no markdown or other text.`
              }
            ],
            max_tokens: 800,
            temperature: 0.7
          })
        });
        
        if (insightResponse.ok) {
          const insightData = await insightResponse.json();
          const content = insightData.choices[0]?.message?.content || '';
          
          try {
            // Try to parse the JSON response
            const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
            aiInsights = JSON.parse(cleanedContent);
            console.log('✓ AI generated', aiInsights.length, 'insights');
          } catch (parseError) {
            console.error('Failed to parse AI insights:', parseError);
            // Use fallback insights
            aiInsights = generateFallbackInsights(metrics, supplierMetrics);
          }
        } else {
          console.error('AI insight generation failed:', insightResponse.status);
          aiInsights = generateFallbackInsights(metrics, supplierMetrics);
        }
      } catch (aiError) {
        console.error('AI insight error:', aiError);
        aiInsights = generateFallbackInsights(metrics, supplierMetrics);
      }
    } else {
      aiInsights = generateFallbackInsights(metrics, supplierMetrics);
    }
    
    console.log('📊 Dashboard generated:', {
      metrics: { total: metrics.total_documents, compliance: metrics.compliance_score },
      suppliers: supplierMetrics.length,
      insights: aiInsights.length
    });
    
    return {
      success: true,
      type: 'compliance_insights_dashboard',
      timeframe,
      metrics: {
        ...metrics,
        trend_data: trendData
      },
      supplier_metrics: supplierMetrics,
      ai_insights: aiInsights
    };
  } catch (error: any) {
    console.error('Error generating compliance insights dashboard:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Fallback insights when AI is unavailable
function generateFallbackInsights(metrics: any, supplierMetrics: any[]) {
  const insights: any[] = [];
  
  if (metrics.expired_documents > 0) {
    insights.push({
      type: 'warning',
      title: 'Expired Documents Detected',
      description: `${metrics.expired_documents} document${metrics.expired_documents > 1 ? 's have' : ' has'} expired and require immediate attention.`,
      action: 'Review expired documents',
      urgency: metrics.expired_documents > 3 ? 'critical' : 'high'
    });
  }
  
  if (metrics.expiring_soon > 0) {
    insights.push({
      type: 'prediction',
      title: 'Upcoming Expirations',
      description: `${metrics.expiring_soon} document${metrics.expiring_soon > 1 ? 's' : ''} will expire in the next 30 days.`,
      action: 'Schedule renewals',
      urgency: metrics.expiring_soon > 5 ? 'high' : 'medium'
    });
  }
  
  if (metrics.pending_documents > 0) {
    insights.push({
      type: 'suggestion',
      title: 'Pending Reviews',
      description: `${metrics.pending_documents} document${metrics.pending_documents > 1 ? 's are' : ' is'} waiting for review.`,
      action: 'Review pending documents',
      urgency: metrics.pending_documents > 10 ? 'high' : 'medium'
    });
  }
  
  const highRiskCount = supplierMetrics.filter(s => s.risk_level === 'high' || s.risk_level === 'critical').length;
  if (highRiskCount > 0) {
    insights.push({
      type: 'warning',
      title: 'High-Risk Suppliers',
      description: `${highRiskCount} supplier${highRiskCount > 1 ? 's have' : ' has'} critical compliance gaps.`,
      action: 'Review supplier status',
      urgency: 'high'
    });
  }
  
  if (metrics.compliance_score >= 80) {
    insights.push({
      type: 'opportunity',
      title: 'Strong Compliance',
      description: `Your compliance score of ${metrics.compliance_score}% is excellent. Keep up the good work!`,
      urgency: 'low'
    });
  }
  
  return insights.slice(0, 4);
}

// ============= DRAFT GENERIC EMAIL =============
// Creates a draft email for user review before sending
async function draftGenericEmail(params: any, authHeader: string) {
  try {
    const { to_email, to_name, subject, body, sender_context } = params;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to_email || !emailRegex.test(to_email)) {
      return {
        success: false,
        error: `Invalid email address format: ${to_email}`,
        needs_info: false
      };
    }
    
    // If subject or body is missing, tell AI to ask user
    if (!subject || !body) {
      return {
        success: false,
        needs_info: true,
        to_email,
        to_name,
        missing_fields: [!subject ? 'subject' : null, !body ? 'body' : null].filter(Boolean),
        message: !subject 
          ? `I have the email address (${to_email}). What would you like this email to be about?`
          : `Got the subject "${subject}". What message would you like me to include in the body?`
      };
    }
    
    console.log('📧 Creating email draft');
    
    // Call the edge function in draft mode
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-generic-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        mode: 'draft',
        to_email,
        to_name: to_name || undefined,
        subject,
        body,
        sender_context: sender_context || 'Sent via Compliance Compass'
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Draft creation failed:', result);
      return {
        success: false,
        error: result.error || 'Failed to create draft'
      };
    }
    
    console.log('✅ Email draft created');
    
    return {
      success: true,
      type: 'email_draft',
      draft_id: result.draft_id,
      requires_confirmation: true,
      draft: {
        to_email,
        to_name: to_name || 'Recipient',
        subject,
        body,
        sender_name: result.sender_name,
        sender_company: result.sender_company
      },
      message: `Here's your draft email. Please review and confirm to send, or let me know if you'd like any changes.`
    };
  } catch (error: any) {
    console.error('❌ Error creating email draft:', error);
    return {
      success: false,
      error: error.message || 'Failed to create draft'
    };
  }
}

// ============= CONFIRM SEND EMAIL =============
// Sends a previously drafted email after user confirmation
// Now more robust: if draft_id is missing/invalid, falls back to most recent draft
async function confirmSendEmail(params: any, authHeader: string) {
  try {
    const { draft_id } = params;
    
    // Log what we received - the edge function will handle fallback if needed
    console.log(`📧 Confirming and sending email. Draft ID received: ${draft_id || '(none/invalid)'}`);
    
    // Call the edge function in send mode
    // The edge function will:
    // 1. Try to find the draft by ID if valid UUID
    // 2. Fall back to most recent draft for this user if not found
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-generic-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        mode: 'send',
        draft_id: draft_id || null // Pass null if missing, edge function handles fallback
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Email send failed:', result);
      return {
        success: false,
        error: result.error || 'Failed to send email'
      };
    }
    
    console.log('✅ Email sent successfully');
    
    return {
      success: true,
      message: `Email sent successfully to ${result.to_email}!`,
      email_id: result.email_id,
      recipient: {
        email: result.to_email,
        name: result.to_name || 'Recipient'
      },
      subject: result.subject
    };
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}

// ============= DRAFT COMPLIANCE EMAIL =============
// Drafts context-aware follow-up emails grouped by supplier
async function draftComplianceEmail(params: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const actionType = params.action_type || 'general_followup';
    const supplierNames = params.supplier_names || [];
    let supplierIds = params.supplier_ids || [];
    const documentIds = params.document_ids || [];
    const customMessage = params.custom_message || '';
    
    console.log('📧 Draft email params:', { actionType, supplierCount: supplierNames.length, documentCount: documentIds.length });
    
    // NEW: Resolve supplier names to IDs using fuzzy matching
    if (supplierNames.length > 0 && supplierIds.length === 0) {
      const { data: connections } = await supabase
        .from('buyer_supplier_connections')
        .select('supplier_id, suppliers(id, company_name)')
        .eq('buyer_id', buyerId)
        .eq('status', 'approved');
      
      for (const searchName of supplierNames) {
        for (const conn of connections || []) {
          const supplierName = (conn.suppliers as any)?.company_name || '';
          if (fuzzyMatch(supplierName, searchName)) {
            const suppId = (conn.suppliers as any)?.id || conn.supplier_id;
            if (!supplierIds.includes(suppId)) {
              supplierIds.push(suppId);
              console.log(`✓ Fuzzy matched "${searchName}" → "${supplierName}" (${suppId})`);
            }
          }
        }
      }
      
      if (supplierIds.length === 0) {
        return {
          success: false,
          error: `No approved supplier found matching "${supplierNames.join(', ')}". Please check the supplier name or connection status.`,
          drafts: []
        };
      }
    }
    
    // 1. Fetch relevant documents based on action type
    let documentsQuery = supabase
      .from('document_uploads')
      .select(`
        id,
        document_name,
        file_name,
        status,
        expiration_date,
        created_at,
        document_requests!inner(
          id,
          title,
          document_type,
          supplier_id,
          buyer_id,
          suppliers(id, company_name, contact_email, profile_id)
        )
      `)
      .eq('document_requests.buyer_id', buyerId);
    
    // Filter by specific suppliers if resolved from names
    if (supplierIds.length > 0) {
      documentsQuery = documentsQuery.in('document_requests.supplier_id', supplierIds);
    }
    
    // Filter by action type
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    if (actionType === 'expired_documents') {
      documentsQuery = documentsQuery.lt('expiration_date', now.toISOString());
    } else if (actionType === 'expiring_documents') {
      documentsQuery = documentsQuery
        .gte('expiration_date', now.toISOString())
        .lte('expiration_date', thirtyDaysFromNow.toISOString());
    } else if (actionType === 'pending_review') {
      documentsQuery = documentsQuery.in('status', ['pending_review', 'submitted']);
    }
    
    // Filter by specific document IDs if provided
    if (documentIds.length > 0) {
      documentsQuery = documentsQuery.in('id', documentIds);
    }
    
    const { data: documents, error: docsError } = await documentsQuery;
    
    if (docsError) throw docsError;
    
    // If no documents found for the specific action type, provide helpful message
    if (!documents || documents.length === 0) {
      const supplierNameList = supplierNames.length > 0 ? ` for ${supplierNames.join(', ')}` : '';
      return {
        success: false,
        error: `No ${actionType.replace(/_/g, ' ')}${supplierNameList}. The supplier may not have any documents matching this criteria.`,
        drafts: []
      };
    }
    
    // 2. Group documents by supplier (CRITICAL for data isolation)
    const supplierGroups = new Map<string, {
      supplier: any;
      documents: any[];
    }>();
    
    for (const doc of documents) {
      const supplier = (doc.document_requests as any)?.suppliers;
      if (!supplier) continue;
      
      const supplierId = supplier.id;
      
      if (!supplierGroups.has(supplierId)) {
        supplierGroups.set(supplierId, {
          supplier,
          documents: []
        });
      }
      
      supplierGroups.get(supplierId)!.documents.push({
        id: doc.id,
        name: doc.document_name || doc.file_name || (doc.document_requests as any)?.title || 'Untitled',
        type: (doc.document_requests as any)?.document_type || 'Document',
        expiration_date: doc.expiration_date,
        status: doc.status
      });
    }
    
    if (supplierGroups.size === 0) {
      return {
        success: false,
        error: 'No suppliers found with matching documents.',
        drafts: []
      };
    }
    
    // 3. Get buyer info for email signature including user role
    const { data: buyer } = await supabase
      .from('buyers')
      .select('company_name, contact_email, profile_id')
      .eq('id', buyerId)
      .single();
    
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', buyer?.profile_id)
      .single();
    
    // NEW: Fetch user role for email signature
    const { data: buyerUser } = await supabase
      .from('company_users')
      .select('role')
      .eq('profile_id', buyer?.profile_id)
      .eq('company_type', 'buyer')
      .maybeSingle();
    
    // Format role for display
    const roleMap: Record<string, string> = {
      'owner': 'Owner',
      'admin': 'Administrator',
      'manager': 'Manager',
      'member': 'Team Member',
      'viewer': 'Viewer'
    };
    const senderRole = roleMap[buyerUser?.role] || buyerUser?.role || 'Compliance Team';
    
    // 4. Fetch recipient details for each supplier
    const drafts: any[] = [];
    
    for (const [supplierId, group] of supplierGroups) {
      const { supplier, documents: supplierDocs } = group;
      
      // Get recipients: primary email, owner, and admins
      const recipients: any[] = [];
      
      // Primary contact email
      if (supplier.contact_email) {
        recipients.push({
          email: supplier.contact_email,
          name: supplier.company_name,
          type: 'primary'
        });
      }
      
      // Supplier owner
      if (supplier.profile_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', supplier.profile_id)
          .single();
        
        if (ownerProfile?.email && ownerProfile.email !== supplier.contact_email) {
          recipients.push({
            email: ownerProfile.email,
            name: ownerProfile.full_name || 'Supplier Owner',
            type: 'owner'
          });
        }
      }
      
      // Company admins
      const { data: admins } = await supabase
        .from('company_users')
        .select('profile_id, profiles(email, full_name)')
        .eq('company_id', supplierId)
        .eq('company_type', 'supplier')
        .in('role', ['admin', 'owner'])
        .eq('status', 'active')
        .limit(3);
      
      for (const admin of admins || []) {
        const adminProfile = admin.profiles as any;
        if (adminProfile?.email && !recipients.some(r => r.email === adminProfile.email)) {
          recipients.push({
            email: adminProfile.email,
            name: adminProfile.full_name || 'Admin',
            type: 'admin'
          });
        }
      }
      
      // If no recipients found, use contact email as fallback
      if (recipients.length === 0 && supplier.contact_email) {
        recipients.push({
          email: supplier.contact_email,
          name: supplier.company_name,
          type: 'primary'
        });
      }
      
      // 5. Generate AI-drafted email content
      let subject = '';
      let body = '';
      
      const docList = supplierDocs.map(d => {
        const expInfo = d.expiration_date 
          ? ` - ${d.status === 'expired' ? 'Expired' : 'Expires'} ${new Date(d.expiration_date).toLocaleDateString()}`
          : '';
        return `• ${d.name}${expInfo}`;
      }).join('\n');
      
      if (OPENAI_API_KEY) {
        try {
          const emailPrompt = `Generate a professional compliance follow-up email for the following scenario:

Action Type: ${actionType.replace(/_/g, ' ')}
Supplier: ${supplier.company_name}
Documents (${supplierDocs.length}):
${docList}

Sender Details:
- Name: ${buyerProfile?.full_name || 'Compliance Team'}
- Role: ${senderRole}
- Company: ${buyer?.company_name || 'Our Company'}
${customMessage ? `Additional Context: ${customMessage}` : ''}

Generate:
1. A clear, professional subject line (max 60 chars)
2. A friendly but professional email body that:
   - Greets the supplier appropriately
   - Clearly explains the compliance issue
   - Lists the specific documents with their status/dates
   - Provides a clear call to action
   - Mentions they can upload through the compliance portal
   - Signs off professionally with the sender's name, role, and company

Format your response as JSON:
{
  "subject": "...",
  "body": "..."
}`;

          const emailResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a professional business communication expert. Generate concise, clear compliance emails. Always include the sender\'s name, role, and company in the signature.' },
                { role: 'user', content: emailPrompt }
              ],
              temperature: 0.7,
              response_format: { type: 'json_object' }
            })
          });
          
          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            const parsed = JSON.parse(emailData.choices[0]?.message?.content || '{}');
            subject = parsed.subject || '';
            body = parsed.body || '';
          }
        } catch (aiError) {
          console.error('AI email generation failed:', aiError);
        }
      }
      
      // Fallback if AI fails
      if (!subject || !body) {
        const actionLabel = {
          expired_documents: 'Expired',
          expiring_documents: 'Expiring Soon',
          pending_review: 'Pending Review',
          general_followup: 'Follow-up Required'
        }[actionType] || 'Action Required';
        
        subject = `Action Required: ${supplierDocs.length} ${actionLabel} Compliance Document${supplierDocs.length > 1 ? 's' : ''}`;
        
        body = `Dear ${supplier.company_name} Team,

I hope this message finds you well.

I wanted to follow up regarding the following compliance documents that require your attention:

${docList}

Please submit the ${actionType === 'expired_documents' ? 'renewed' : 'updated'} documents through the compliance portal at your earliest convenience.

If you have any questions or need assistance, please don't hesitate to reach out.

Best regards,
${buyerProfile?.full_name || 'Compliance Team'}
${senderRole}
${buyer?.company_name || ''}`;
      }
      
      drafts.push({
        supplier_id: supplierId,
        supplier_name: supplier.company_name,
        recipients,
        subject,
        body,
        documents: supplierDocs
      });
    }
    
    console.log(`✓ Generated ${drafts.length} email drafts for ${actionType}`);
    
    return {
      success: true,
      type: 'email_composer',
      action_type: actionType,
      total_suppliers: drafts.length,
      total_documents: documents.length,
      buyer_id: buyerId,
      drafts
    };
  } catch (error: any) {
    console.error('Error drafting compliance email:', error);
    return {
      success: false,
      error: error.message,
      drafts: []
    };
  }
}


async function getMissingRequiredDocuments(params: any, buyerId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // 1. Find supplier by name (fuzzy match)
    const { data: connections } = await supabase
      .from('buyer_supplier_connections')
      .select('id, supplier_id, suppliers(id, company_name)')
      .eq('buyer_id', buyerId)
      .eq('status', 'approved');
    
    let matchedSupplier = null;
    for (const conn of connections || []) {
      if (fuzzyMatch(conn.suppliers?.company_name || '', params.supplier_name)) {
        matchedSupplier = conn.suppliers;
        break;
      }
    }
    
    if (!matchedSupplier) {
      return {
        success: false,
        error: `No approved supplier found matching "${params.supplier_name}"`,
        missing_documents: []
      };
    }
    
    // 2. Get required documents (from set or default requirements)
    let requiredDocs: string[] = [];
    let requiredSetInfo = null;
    
    if (params.required_set_id) {
      const { data: docSet } = await supabase
        .from('document_sets')
        .select('*')
        .eq('id', params.required_set_id)
        .eq('buyer_id', buyerId)
        .single();
      
      if (docSet) {
        requiredDocs = docSet.document_ids || [];
        requiredSetInfo = { id: docSet.id, name: docSet.set_name };
      }
    } else {
      // Use default requirements
      const { data: defaults } = await supabase
        .from('default_document_requirements')
        .select('document_type, document_name')
        .eq('buyer_id', buyerId)
        .eq('is_required', true);
      
      requiredDocs = defaults?.map(d => d.document_type) || [];
      requiredSetInfo = { id: 'default', name: 'Default Requirements' };
    }
    
    // 3. Get uploaded & approved documents for this supplier
    const { data: uploads } = await supabase
      .from('document_uploads')
      .select(`
        document_requests!inner(
          document_type,
          supplier_id
        )
      `)
      .eq('document_requests.supplier_id', matchedSupplier.id)
      .eq('status', 'approved');
    
    const uploadedTypes = new Set(
      uploads?.map((u: any) => u.document_requests?.document_type) || []
    );
    
    // 4. Find missing documents
    const missingDocuments = requiredDocs.filter(docType => !uploadedTypes.has(docType));
    
    // Calculate compliance correctly: submitted REQUIRED docs / total required docs
    const submittedRequiredCount = requiredDocs.filter(docType => uploadedTypes.has(docType)).length;
    
    console.log('🔍 Missing documents check:', {
      supplier: matchedSupplier.company_name,
      required: requiredDocs.length,
      submitted_required: submittedRequiredCount, // Only count required docs that were submitted
      total_submitted: uploadedTypes.size, // Total docs submitted (including non-required)
      missing: missingDocuments.length
    });
    
    return {
      success: true,
      supplier: {
        id: matchedSupplier.id,
        name: matchedSupplier.company_name
      },
      required_set: requiredSetInfo,
      total_required: requiredDocs.length,
      total_submitted: submittedRequiredCount, // Changed: only count required docs that were submitted
      total_submitted_all: uploadedTypes.size, // New: total docs including non-required
      missing_count: missingDocuments.length,
      missing_documents: missingDocuments,
      compliance_percentage: requiredDocs.length > 0 ? 
        Math.round((submittedRequiredCount / requiredDocs.length) * 100) : 0 // Fixed calculation
    };
  } catch (error: any) {
    console.error('Error getting missing documents:', error);
    return {
      success: false,
      error: error.message,
      missing_documents: []
    };
  }
}

async function executeToolCall(
  toolName: string, 
  args: any, 
  buyerId: string,
  context?: {
    supplierId?: string | null;
    sessionId?: string | null;
    userId?: string;
    authHeader?: string;
  }
) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  switch (toolName) {
    case "query_documents":
      return await queryDocuments(args, buyerId);
    case "query_suppliers":
      return await querySuppliers(args, buyerId);
    case "get_compliance_metrics":
      return await getComplianceMetrics(args, buyerId);
    case "get_document_timeseries":
      return await getDocumentTimeseries(args, buyerId);
    case "get_missing_required_documents":
      return await getMissingRequiredDocuments(args, buyerId);
    case "create_document_request":
      return await createDocumentRequest(args, buyerId);
    case "get_document_sets":
      return await getDocumentSets(buyerId);
    case "generate_visualization_code":
      return await generateVisualizationCode(args, buyerId);
    case "create_requests_for_missing":
      console.log('📋 Creating requests for missing documents:', args);
      return await createRequestsForMissing(args, buyerId);
    case "send_notification":
      console.log('✉️ Sending notification:', args);
      return await sendNotification(args);
    case "acknowledge_and_log":
      console.log('📝 Logging acknowledgment:', args);
      return await acknowledgeAndLog(args);
    case "export_csv":
      console.log('📊 Exporting CSV:', args);
      return await exportCSV(args, buyerId);
    case "audit_trail":
      console.log('📜 Getting audit trail:', args);
      return await getAuditTrail(args);
    case "get_compliance_insights_dashboard":
      console.log('📊 Generating compliance insights dashboard:', args);
      return await getComplianceInsightsDashboard(args, buyerId);
    case "draft_compliance_email":
      console.log('📧 Drafting compliance follow-up email');
      return await draftComplianceEmail(args, buyerId);
    case "draft_generic_email":
      console.log('📧 Creating generic email draft');
      return await draftGenericEmail(args, context?.authHeader || '');
    case "confirm_send_email":
      console.log('📧 Confirming and sending email');
      return await confirmSendEmail(args, context?.authHeader || '');
    
    // ============= DOCUMENT COMPARISON TOOLS =============
    case "find_documents_for_comparison":
      console.log('🔍 Finding documents for comparison:', args);
      if (!context?.authHeader) {
        return { success: false, error: 'Authorization required for document comparison' };
      }
      return await findDocumentsForComparison(
        args,
        buyerId,
        context.supplierId || null,
        context.sessionId || null,
        context.authHeader
      );
    
    case "execute_document_comparison":
      console.log('📊 Executing document comparison:', args);
      if (!context?.authHeader || !context?.userId) {
        return { success: false, error: 'Authorization required for document comparison' };
      }
      return await executeDocumentComparison(
        args,
        buyerId,
        context.supplierId || null,
        context.sessionId || null,
        context.userId,
        context.authHeader
      );
    
    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
}

// ============= SESSION STATE MANAGEMENT =============
// Updates session state after tool calls for context-aware follow-ups
async function updateSessionState(
  sessionId: string, 
  toolName: string, 
  toolArgs: any,
  toolResult: any
) {
  try {
    // Fetch current state
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('state')
      .eq('id', sessionId)
      .single();
    
    const currentState = session?.state || {};
    
    // Build state patch based on tool
    let statePatch: any = {
      last_tool: { name: toolName, at: new Date().toISOString() }
    };
    
    // Tool-specific state updates
    if (toolName === 'query_suppliers' && toolResult.success && toolResult.suppliers?.length > 0) {
      statePatch.last_suppliers = toolResult.suppliers.slice(0, 5).map((s: any) => ({
        id: s.supplier_id,
        name: s.supplier_name
      }));
    }
    
    if (toolName === 'get_missing_required_documents' && toolResult.success) {
      statePatch.current_supplier_name = toolResult.supplier?.name;
      statePatch.current_supplier_id = toolResult.supplier?.id;
      statePatch.last_missing_documents = toolResult.missing_documents;
      statePatch.last_compliance_percentage = toolResult.compliance_percentage;
    }
    
    if (toolName === 'query_documents' && toolResult.success) {
      statePatch.last_document_query = {
        filters: toolArgs,
        count: toolResult.documents?.length || 0,
        at: new Date().toISOString()
      };
      // If filtered by single supplier, store it
      if (toolArgs.supplier_names?.length === 1) {
        statePatch.current_supplier_name = toolArgs.supplier_names[0];
      }
    }
    
    if (toolName === 'create_document_request' && toolResult.success) {
      statePatch.last_created_requests = {
        supplier_name: toolResult.supplier_name,
        document_types: toolResult.document_types,
        request_ids: toolResult.request_ids,
        at: new Date().toISOString()
      };
      // Clear pending action after successful creation
      statePatch.pending_action = null;
    }
    
    if (toolName === 'get_document_sets' && toolResult.success) {
      statePatch.available_document_sets = toolResult.document_sets?.map((s: any) => ({
        id: s.id,
        name: s.name
      }));
    }
    
    // Merge and save
    const newState = { ...currentState, ...statePatch };
    await supabase
      .from('chat_sessions')
      .update({ 
        state: newState,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    console.log('✓ Updated session state:', Object.keys(statePatch));
  } catch (error) {
    console.error('Failed to update session state:', error);
  }
}

// ============= ROLLING SUMMARIZATION =============
// Compresses older messages into a summary for long conversations
async function maybeUpdateSummary(sessionId: string) {
  try {
    // Get message count and last summary time
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('summary, summary_updated_at')
      .eq('id', sessionId)
      .single();
    
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    
    // Trigger if: 20+ messages AND (no summary OR 12+ messages since last summary)
    const messageThreshold = 20;
    const updateThreshold = 12;
    
    if (!count || count < messageThreshold) {
      return; // Not enough messages yet
    }
    
    // Calculate messages since last summary
    let messagesSinceSummary = count;
    if (session?.summary_updated_at) {
      const { count: recentCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .gt('created_at', session.summary_updated_at);
      messagesSinceSummary = recentCount || 0;
    }
    
    if (messagesSinceSummary < updateThreshold && session?.summary) {
      return; // Recent summary still valid
    }
    
    console.log('📝 Triggering summary generation:', { totalMessages: count, messagesSinceSummary });
    
    // Fetch messages to summarize (all except last 12)
    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (!allMessages || allMessages.length < messageThreshold) return;
    
    const keepRecent = 12;
    const toSummarize = allMessages.slice(0, Math.max(0, allMessages.length - keepRecent));
    
    if (toSummarize.length === 0) return;
    
    const summaryPrompt = `You are summarizing a compliance assistant conversation. Create a concise summary (max 10 bullet points) capturing:
- User's goals and questions asked
- Supplier names mentioned (with context)
- Document types discussed
- Decisions made or actions taken
- Pending requests or follow-ups needed

${session?.summary ? `Previous summary to incorporate:\n${session.summary}\n\n` : ''}

Messages to summarize (${toSummarize.length} messages):
${toSummarize.map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}`).join('\n\n')}

Provide updated summary (bullet points, max 10):`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use cheaper model for summarization
        messages: [{ role: 'user', content: summaryPrompt }],
        max_tokens: 500,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`Summary generation failed: ${response.status}`);
    }
    
    const result = await response.json();
    const newSummary = result.choices[0]?.message?.content;
    
    if (newSummary) {
      await supabase
        .from('chat_sessions')
        .update({ 
          summary: newSummary,
          summary_updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      console.log('✓ Summary updated:', newSummary.substring(0, 100) + '...');
    }
  } catch (error) {
    console.error('Summary generation failed:', error);
    // Non-critical, don't throw
  }
}

async function callOpenAI(messages: any[], toolChoice: any = "auto") {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: toolChoice,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // ============= AUTH VALIDATION =============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ User authenticated');

    // Parse request body
    const { buyer_id: requested_buyer_id, question, session_id: incoming_session_id, user_context } = await req.json();

    // ============= RESOLVE USER'S ACTUAL BUYER ID =============
    let actualBuyerId: string | null = null;

    // Check if user is a team member
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id, company_type')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .single();

    if (companyUser?.company_type === 'buyer') {
      actualBuyerId = companyUser.company_id;
    } else {
      // Check if user is a buyer owner
      const { data: buyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      actualBuyerId = buyer?.id || null;
    }

    // ============= VALIDATE COMPANY ACCESS =============
    if (!actualBuyerId) {
      console.error('❌ User has no buyer access');
      return new Response(
        JSON.stringify({ error: 'User is not associated with a buyer company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use actual buyer ID (prevents cross-tenant access)
    const buyer_id = actualBuyerId;
    
    // Log if requested_buyer_id doesn't match (potential security issue)
    if (requested_buyer_id && requested_buyer_id !== actualBuyerId) {
      console.warn('⚠️ SECURITY: Requested buyer_id mismatch!');
    }

    // Validate user_context.user_id matches authenticated user
    if (user_context?.user_id && user_context.user_id !== user.id) {
      console.warn('⚠️ SECURITY: user_context.user_id mismatch, using authenticated user');
    }

    const companyType = user_context?.company_type || 'buyer';
    const industry = user_context?.industry || 'General';

    // Defensive session creation: if no session_id provided, create one
    let session_id = incoming_session_id;
    if (!session_id) {
      console.log('⚠️ No session_id provided, creating new session...');
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id, // Use authenticated user ID
          company_id: buyer_id, // Use validated buyer_id
          company_type: companyType,
          session_title: 'New Chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (sessionError) {
        console.error('Failed to create session:', sessionError);
      } else {
        session_id = newSession.id;
        console.log('✓ Created new session:', session_id);
      }
    }
    
    console.log('simple-rag-chat request:', { question: question?.substring(0, 50), session_id });
    console.log('User context:', { company_type: companyType, industry });

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent conversation history for context
    let conversationHistory: any[] = [];
    let pendingAction: any = null;
    let sessionSummary: string | null = null;
    let sessionState: any = {};
    
    if (session_id) {
      // Load session with summary and state for production-ready context
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id, summary, state, summary_updated_at')
        .eq('id', session_id)
        .single();
      
      if (session) {
        sessionSummary = session.summary;
        sessionState = session.state || {};
        console.log('Loaded session context:', { 
          hasSummary: !!sessionSummary, 
          stateKeys: Object.keys(sessionState),
          summaryAge: session.summary_updated_at ? 
            Math.round((Date.now() - new Date(session.summary_updated_at).getTime()) / 60000) + 'min' : 'N/A'
        });
      }
      
      // Increased limit from 8 to 20 for better multi-turn context
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('role, content, created_at, metadata')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentMessages && recentMessages.length > 0) {
        // Reverse to get chronological order (oldest first)
        // CRITICAL FIX: Preserve metadata for context-aware follow-ups
        conversationHistory = recentMessages
          .reverse()
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            role: msg.role,
            content: msg.content,
            metadata: msg.metadata || {} // Preserve metadata for tool tracking
          }));
        
        // Check for pending actions in recent assistant messages
        const assistantWithPending = recentMessages.find(
          msg => msg.role === 'assistant' && msg.metadata?.pending_action
        );
        
        if (assistantWithPending) {
          pendingAction = assistantWithPending.metadata.pending_action;
          console.log('Found pending action:', pendingAction);
        }
        
        console.log(`Loaded ${conversationHistory.length} messages from conversation history`);
      }
    }

    // Helper to parse natural language dates
    const parseNaturalDate = (text: string): string | null => {
      const today = new Date();
      
      // Match patterns like "nov 30", "november 30", "end of november", "by november"
      const monthEndMatch = text.match(/(?:end of|by)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i);
      if (monthEndMatch) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.findIndex(m => m.startsWith(monthEndMatch[1].toLowerCase()));
        if (monthIndex >= 0) {
          const year = monthIndex < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
          const lastDay = new Date(year, monthIndex + 1, 0).getDate();
          return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
      }
      
      // Match "nov 30", "november 30", "oct 25"
      const monthDayMatch = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
      if (monthDayMatch) {
        const monthAbbr = monthDayMatch[1].toLowerCase().substring(0, 3);
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIndex = monthNames.indexOf(monthAbbr);
        if (monthIndex >= 0) {
          const day = parseInt(monthDayMatch[2]);
          const year = monthIndex < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
          return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
      
      // Match YYYY-MM-DD format
      const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return isoMatch[0];
      
      return null;
    };
    
    // ============= VISUALIZATION INTENT ROUTER =============
    // This router intercepts chart/graph requests and handles them directly
    // without going through the LLM to avoid misinterpretation
    
    const chartKeywordPattern = /(chart|graph|plot|visuali[sz]e|trend|line|bar|pie|timeseries|vs|over time)/i;
    const hasChartIntent = chartKeywordPattern.test(question);
    
    if (hasChartIntent) {
      console.log('🎨 Visualization intent detected, routing directly...');
      
      // Extract time window (e.g., "last 60 days")
      const timeWindowMatch = question.match(/last\s+(\d+)\s+days/i);
      const time_window_days = timeWindowMatch ? parseInt(timeWindowMatch[1]) : undefined;
      
      if (time_window_days) {
        console.log(`⏰ Time window detected: ${time_window_days} days`);
      }
      
      // Determine chart type
      let visualization_type = 'bar_chart';
      if (/(line|trend)/i.test(question)) visualization_type = 'line_chart';
      else if (/pie/i.test(question)) visualization_type = 'pie_chart';
      else if (/bar/i.test(question)) visualization_type = 'bar_chart';
      
      // Detect if this is a multi-series request (vs, split by, for each)
      const isVsPattern = /\bvs\b|\b(and|split by|for each|by)\s+(status|supplier|document|type)/i.test(question);
      const hasStatusComparison = /(approved|pending|submitted|rejected).*?(vs|and|split|each).*?(approved|pending|submitted|rejected)/i.test(question);
      
      let aggregation = 'count';
      let group_by: string | undefined = undefined;
      let x_axis = 'created_at';
      let time_period = 'day';
      
      // Determine aggregation and grouping
      if (hasStatusComparison || /\bvs\b/i.test(question)) {
        // Multi-series time chart (e.g., "approved vs pending vs submitted")
        aggregation = 'time_series_grouped';
        group_by = 'status';
        x_axis = 'created_at';
        
        // Use daily buckets for time windows <= 90 days, weekly for longer
        time_period = time_window_days && time_window_days <= 90 ? 'day' : 'week';
        
        console.log('📊 Multi-series time chart detected (status comparison)');
      } else if (/over time|trend/i.test(question) && !/by supplier|for each supplier/i.test(question)) {
        // Single time series
        aggregation = 'time_series';
        x_axis = 'created_at';
        console.log('📈 Single time series detected');
      } else if (/(by supplier|for each supplier)/i.test(question)) {
        // Group by supplier
        aggregation = 'group_by';
        x_axis = 'supplier_name';
        console.log('🏢 Group by supplier detected');
      }
      
      // Build filters
      const filters: any = {
        limit: 1000 // Force high limit for visualizations
      };
      
      // Add time window filter if specified
      if (time_window_days) {
        filters.time_window_days = time_window_days;
      }
      
      // Normalize status filters (map "submitted" to "pending_review")
      const statusPattern = /approved|pending|submitted|rejected/gi;
      const statusMatches = question.match(statusPattern);
      if (statusMatches && !hasStatusComparison) {
        // If not comparing statuses, filter by them
        const normalizedStatuses = statusMatches.map((s: string) => 
          s.toLowerCase() === 'submitted' ? 'pending_review' : s.toLowerCase()
        );
        filters.status = [...new Set(normalizedStatuses)];
      }
      
      console.log('🔧 Chart config:', {
        visualization_type,
        aggregation,
        group_by,
        x_axis,
        time_period,
        filters
      });
      
      // Build args for generateVisualizationCode
      const vizArgs = {
        visualization_type,
        data_query: {
          query_type: 'documents',
          filters
        },
        chart_config: {
          x_axis,
          y_axis: 'count',
          aggregation,
          group_by,
          time_period,
          title: `Document ${aggregation === 'time_series_grouped' ? 'Trends' : 'Distribution'}`
        }
      };
      
      // Call generateVisualizationCode directly
      const vizResult = await generateVisualizationCode(vizArgs, buyer_id);
      
      if (vizResult.success) {
        const summary = `I've generated a ${visualization_type.replace('_', ' ')} showing ${
          aggregation === 'time_series_grouped' 
            ? `document trends over time${group_by ? ` by ${group_by}` : ''}`
            : aggregation === 'time_series'
            ? 'document trends over time'
            : `documents by ${x_axis.replace('_', ' ')}`
        }${time_window_days ? ` for the last ${time_window_days} days` : ''}.`;
        
        // Save to chat history
        const userMsg = { session_id, role: 'user', content: question, metadata: {} };
        const assistantMsg = {
          session_id,
          role: 'assistant',
          content: summary,
          metadata: {
            code_visualization: {
              code: vizResult.code,
              data: vizResult.data,
              summary: vizResult.summary
            }
          }
        };

        // Create Supabase client for database operations
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        await supabase.from('chat_messages').insert([userMsg, assistantMsg]);
        
        return new Response(JSON.stringify({
          answer: summary,
          structured_response: {
            type: 'code_visualization',
            code: vizResult.code,
            data: vizResult.data,
            summary: vizResult.summary
          },
          session_id,
          conversation_history: [...conversationHistory, userMsg, assistantMsg]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.error('❌ Visualization generation failed:', vizResult.error);
        // Fall through to normal LLM processing
      }
    }
    
    // ============= LLM-BASED PENDING ACTION INTERCEPTOR =============
    // Use LLM to intelligently detect if user is confirming or modifying a pending action
    if (pendingAction) {
      const lastAssistantMsg = [...conversationHistory].reverse().find(m => m.role === 'assistant');
      
      // Track the last tool called (used to detect if it was a read-only tool)
      const lastToolMsg = [...conversationHistory].reverse().find(m => m.metadata?.tool_name);
      const lastToolCalled = lastToolMsg?.metadata?.tool_name || pendingAction?.last_tool_called || null;
      
      const analysis = await analyzePendingAction({
        assistantMessage: lastAssistantMsg?.content || '',
        userResponse: question,
        conversationHistory: conversationHistory.slice(-3),
        openaiApiKey: OPENAI_API_KEY,
        lastToolCalled
      });

      console.log('📊 Pending action analysis result:', {
        hasPendingAction: analysis.hasPendingAction,
        userConfirmed: analysis.userConfirmed,
        isReadOnlyQuery: analysis.isReadOnlyQuery,
        hasModifications: Object.keys(analysis.userModifications).length > 0
      });

      // CRITICAL GUARD: Prevent auto-execution on read-only queries
      if (analysis.isReadOnlyQuery && !analysis.userConfirmed) {
        console.log('⚠️ Blocking auto-execution: READ-ONLY query detected without explicit confirmation');
        // Let normal conversation flow handle this - AI will ask for confirmation
        // Do not execute pending action
      } else if (analysis.userConfirmed || Object.keys(analysis.userModifications).length > 0) {
        console.log('🎯 Intercepting reply - executing pending action with LLM analysis');
        
        // Merge extracted modifications with pending action params
        const finalParams = {
          ...pendingAction.params,
          // Apply user modifications
          ...(analysis.userModifications.due_date && { due_date: analysis.userModifications.due_date }),
          ...(analysis.userModifications.priority && { priority: analysis.userModifications.priority }),
          ...(analysis.userModifications.notes !== undefined && { notes: analysis.userModifications.notes }),
          // If LLM extracted new data, prefer that
          ...(analysis.extractedParams.supplier_name && { supplier_name: analysis.extractedParams.supplier_name }),
          ...(analysis.extractedParams.document_types?.length && { document_types: analysis.extractedParams.document_types })
        };

        console.log('📦 Final params for execution:', finalParams);
    
        if (pendingAction?.type === 'create_document_request') {
          // Execute the request directly
          const result = await createDocumentRequest(finalParams, buyer_id);
      
      // Save both user message and assistant response
      const userMsg = {
        session_id,
        role: 'user',
        content: question,
        metadata: {}
      };
      
      const responseText = result.success
        ? `✓ Created ${result.created_count} document request${result.created_count > 1 ? 's' : ''} for ${result.supplier_name}:\n- Documents: ${result.document_types?.join(', ')}\n- Due: ${result.due_date}\n- Priority: ${result.priority}${finalParams.notes ? `\n- Notes: ${finalParams.notes}` : ''}`
        : `I couldn't create the request: ${result.error || 'Unknown error'}`;
      
      const assistantMsg = {
        session_id,
        role: 'assistant',
        content: responseText,
        metadata: result.success ? { action: 'document_requests_created', data: result } : {}
      };
      
          await supabase.from('chat_messages').insert([userMsg, assistantMsg]);
          
          return new Response(JSON.stringify({
            answer: responseText,
            structured_response: result.success ? {
              action: 'document_requests_created',
              data: result,
              response: responseText
            } : undefined,
            session_id,
            conversation_history: [...conversationHistory, userMsg, assistantMsg]
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }
    }

    // Build memory preamble from session summary and state
    const memoryPreamble = (sessionSummary || Object.keys(sessionState).length > 0) ? {
      role: "system",
      content: `## CONVERSATION MEMORY (use this for context-aware follow-ups)

### Summary of Earlier Discussion:
${sessionSummary || "This is a new conversation - no previous context."}

### Current Session State (authoritative context for follow-ups like "create them", "same supplier", "that list"):
${JSON.stringify(sessionState, null, 2)}

CRITICAL: When user says "create them", "same supplier", "that list", or similar references, use the state above to resolve context. Do NOT ask for clarification if the information is in session state.`
    } : null;

    // Step 1: Initial conversation with OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a compliance assistant helping a ${companyType} in the ${industry} industry manage their ${companyType === 'buyer' ? 'supplier documents and compliance' : 'document submissions and buyer requirements'}. Today's date is ${new Date().toISOString().split('T')[0]}.

USER CONTEXT:
- Role: ${companyType.toUpperCase()}
- Industry: ${industry}
- This means you should provide responses relevant to ${industry}-specific compliance requirements and terminology.

Use the available tools to answer questions about:
- Documents (certificates, safety sheets, insurance, etc.)
- Suppliers and their connection status
- Compliance metrics and statistics
- Creating document requests for suppliers

CUSTOM VISUALIZATIONS - CRITICAL REQUIREMENTS:

When calling generate_visualization_code, you MUST provide complete and accurate chart_config. Missing parameters will result in poor visualizations.

REQUIRED PARAMETERS FOR ALL VISUALIZATIONS:
- x_axis: The field to group/bucket by (e.g., 'supplier_name', 'created_at', 'status', 'document_type')
- y_axis: Typically 'count' for counting items, or a specific numeric field for sums
- aggregation: HOW to process the data (see below)
- title: Descriptive chart title

AGGREGATION TYPES:

1. "count" - For simple bar/pie charts counting items by category
   Example: Count documents per supplier
   {
     "visualization_type": "bar_chart",
     "data_query": { "query_type": "documents", "filters": {} },
     "chart_config": {
       "x_axis": "supplier_name",
       "y_axis": "count",
       "aggregation": "count",
       "title": "Document Counts by Supplier"
     }
   }

2. "time_series" - For single-line time trends
   Example: Total approved documents over time
   {
     "visualization_type": "line_chart",
     "data_query": { "query_type": "documents", "filters": { "status": ["approved"] } },
     "chart_config": {
       "x_axis": "approved_at",
       "y_axis": "count",
       "aggregation": "time_series",
       "time_period": "month",
       "title": "Approved Documents Over Time"
     }
   }

3. "time_series_grouped" - For MULTI-SERIES time trends (e.g., "for each supplier" or "split by status")
   Example: Documents over time, one line per supplier
   {
     "visualization_type": "line_chart",
     "data_query": { "query_type": "documents", "filters": {} },
     "chart_config": {
       "x_axis": "created_at",
       "y_axis": "count",
       "aggregation": "time_series_grouped",
       "group_by": "supplier_name",
       "time_period": "month",
       "title": "Document Trends by Supplier"
     }
   }

4. "group_by_multiple" - For GROUPED BAR CHARTS (e.g., "documents by supplier, grouped by status")
   Example: Document status breakdown per supplier
   {
     "visualization_type": "bar_chart",
     "data_query": { "query_type": "documents", "filters": {} },
     "chart_config": {
       "x_axis": "supplier_name",
       "y_axis": "count",
       "aggregation": "group_by_multiple",
       "group_by": "status",
       "title": "Document Status by Supplier"
     }
   }

5. "sum" - For summing numeric values
   Example: Total value by category
   {
     "visualization_type": "bar_chart",
     "chart_config": {
       "x_axis": "category",
       "y_axis": "amount",
       "aggregation": "sum",
       "title": "Total Amount by Category"
     }
   }

CRITICAL DECISION LOGIC:
- User says "for each supplier" or "by supplier over time" → use "time_series_grouped" with group_by="supplier_name"
- User says "split by status" or "grouped by status" → use "time_series_grouped" or "group_by_multiple" with group_by="status"
- User says "trend" or "over time" without grouping → use "time_series"
- User says "how many documents" per category → use "count"
- User wants comparison across categories → use "group_by_multiple"

ALWAYS INCLUDE:
- Appropriate aggregation type based on user request
- group_by field when request implies multi-series ("for each", "by", "split by")
- time_period ("month", "week", "day") for time-series
- Clear, descriptive title

CRITICAL - NEVER NARRATE INTENT:
- DO NOT say: "I'll retrieve...", "Let me check...", "Please hold on...", "I'm going to..."
- JUST CALL THE TOOL IMMEDIATELY
- Present results directly without announcing what you're about to do
- Exception: Confirmations for write actions (create/update/delete)

INSTANT ACTION RULES - QUERY ROUTING:

Match user query → call appropriate tool IMMEDIATELY (no narration):

📊 CHARTS & TRENDS:
- "show chart", "line chart", "trend", "over time", "past X days" 
  → get_document_timeseries

🔍 MISSING DOCUMENTS:
- "what's missing", "compliance gaps", "outstanding from", "not submitted"
  → get_missing_required_documents

⏰ EXPIRING DOCUMENTS:
- "expiring soon", "expires in X days", "about to expire"
  → query_documents with expiring_days parameter

👥 SUPPLIER LOOKUP:
- "find supplier", "supplier info", "who is", "details about"
  → resolve_supplier (get exact match), then proceed with follow-up query

📄 DOCUMENT QUERIES:
- "show documents", "list docs", "approved/pending/rejected from"
  → query_documents

📈 METRICS:
- "compliance score", "stats", "how many", "percentage"
  → get_compliance_metrics

🎯 COMPLIANCE INSIGHTS DASHBOARD:
- "how does my day look", "give me insights", "show my dashboard"
- "what should I focus on today", "daily briefing", "compliance overview"
- "show me the big picture", "executive summary", "compliance compass"
  → get_compliance_insights_dashboard
This returns a RICH DASHBOARD with metrics, AI insights, supplier matrix, and trend charts.
DO NOT use this for specific document queries - use query_documents instead.

IMPORTANT - STATUS MAPPING:
- When user asks for "pending", "pending review", or "submitted" documents:
  → Use BOTH statuses: ["pending_review", "submitted"] in your queries
- Both "pending_review" and "submitted" display as "Submitted" in charts
- This ensures complete data for pending/submitted documents

NEW WRITE TOOLS GUIDANCE:

1. create_requests_for_missing:
   - Use when: User confirms after seeing missing docs, OR says "request everything missing"
   - Trigger phrases: "create these", "request all", "fill gaps", "send requests"
   - Auto-execution: If user already said "request all missing from X" → gather details, confirm, execute
   - Always show compliance % before and after in response

2. send_notification:
   - Use when: User explicitly asks for notification ("notify me", "alert supplier")
   - Don't spam - only for important confirmations after major actions

3. acknowledge_and_log:
   - ALWAYS call after executing write actions (create requests, bulk operations)
   - Happens silently in background - don't announce it to user
   - Include full payload for compliance audit trail

4. export_csv:
   - Use when: "download", "export", "save as CSV", "give me a file"
   - Returns download link - present as: "📥 Download CSV (X records)"
   - Frontend auto-displays download button

5. audit_trail:
   - Use when: "what changed?", "show history", "who did what?", "activity log"
   - Format as timeline with dates, actors, actions

TWO-STEP ACTIONS (Write Operations):

Step 1 - GATHER DETAILS (don't execute yet):
- "create request", "send to supplier", "request documents"
  → Confirm: supplier name, document types, due date, priority
  → Present plan: "I'll create X requests for Y with Z due date. Proceed?"

Step 2 - EXECUTE ON CONFIRMATION (no further delay):
Confirmation keywords: "yes", "proceed", "go ahead", "do it", "ok", "confirm", "create", "send"
- If user says ANY confirmation keyword → IMMEDIATELY call the action tool
- DO NOT say "I will now..." or "Let me..."
- JUST EXECUTE and report results

Example flow:
User: "request missing docs from Kerry"
AI: [calls get_missing_required_documents] → "Kerry is missing: Certificate A, License B (67% compliant). Create these requests now?"
User: "yes"
AI: [IMMEDIATELY calls create_requests_for_missing] → "✓ Created 2 requests for Kerry (due: 2025-10-25)"

NEW TOOL GUIDANCE - get_document_timeseries:
Use this tool for ANY request about trends, time-based analysis, or line charts:
- "Show document trends over the last 60 days" → get_document_timeseries({ days: 60 })
- "Line chart of approved vs pending over time" → get_document_timeseries({ days: 60, statuses: ["approved", "pending_review"] })
- "How have submissions changed this quarter?" → get_document_timeseries({ days: 90 })
- "Document approval trends" → get_document_timeseries({ statuses: ["approved"] })
- "Show me trends for the past week" → get_document_timeseries({ days: 7 })

This tool returns ready-to-chart data with labels and series arrays. It automatically handles:
- Time bucketing (daily/weekly/monthly based on window size)
- Multi-series data for status comparisons
- Proper data normalization for chart rendering

PREFER this tool over generate_visualization_code for time-series charts!

NEW TOOL GUIDANCE - get_missing_required_documents:
Use this tool to identify compliance gaps for specific suppliers:
- "What documents are missing from Kerry?" → get_missing_required_documents({ supplier_name: "Kerry" })
- "Which requirements has Supplier X not met?" → get_missing_required_documents({ supplier_name: "Supplier X" })
- "Show me what Killer still needs to submit" → get_missing_required_documents({ supplier_name: "Killer" })
- "Check compliance gaps for [supplier]" → get_missing_required_documents({ supplier_name: "[supplier]" })
- "What's missing from X for doc set Y?" → get_missing_required_documents({ supplier_name: "X", required_set_id: "Y" })

This tool compares required documents (from sets or defaults) against approved uploads and returns:
- List of missing document types
- Compliance percentage
- Total required vs total submitted counts

EMAIL FOLLOW-UP HANDLING - draft_compliance_email:
Use this tool when user wants to send emails or follow up with suppliers about documents:

Trigger phrases (IMMEDIATELY call draft_compliance_email):
- "Send email to [supplier]" → draft_compliance_email({ action_type: "general_followup", supplier_names: ["supplier"] })
- "Email [supplier] about expired docs" → draft_compliance_email({ action_type: "expired_documents", supplier_names: ["supplier"] })
- "Follow up with [supplier]" → draft_compliance_email({ action_type: "general_followup", supplier_names: ["supplier"] })
- "Draft email to [supplier] about expiring documents" → draft_compliance_email({ action_type: "expiring_documents", supplier_names: ["supplier"] })
- "Send reminder to [supplier] about pending documents" → draft_compliance_email({ action_type: "pending_review", supplier_names: ["supplier"] })

Action type mapping:
- "expired", "overdue" → action_type: "expired_documents"
- "expiring", "expiring soon", "about to expire" → action_type: "expiring_documents"  
- "pending", "submitted", "awaiting review" → action_type: "pending_review"
- Generic follow-up → action_type: "general_followup"

The tool will:
1. Fuzzy match supplier names to find the correct supplier
2. Pull all relevant documents for that supplier based on action_type
3. Draft a personalized email with the user's name, role, and company
4. Return an email composer UI where user can review/edit before sending

Example flow:
User: "Hey send an email to Test Supplier about expired documents"
AI: [IMMEDIATELY calls draft_compliance_email({ action_type: "expired_documents", supplier_names: ["Test Supplier"] })]
→ Returns email composer with drafted email showing all expired docs from Test Supplier

GENERIC EMAIL HANDLING - draft_generic_email & confirm_send_email:

Use these tools for emails to ANY email address (not just existing suppliers in the system).
For compliance-related emails to existing suppliers, prefer draft_compliance_email instead.

CONVERSATIONAL FLOW (CRITICAL - FOLLOW THIS EXACTLY):

Phase 1 - GATHER EMAIL ADDRESS:
User says: "send an email to john@example.com" or "email rcrohith017@gmail.com"
AI response: "Sure! What would you like this email to be about?"
[DO NOT call draft_generic_email yet - wait for subject/content]

Phase 2 - GATHER CONTENT:
User provides topic: "just say hey this is a test"
AI MUST call draft_generic_email with all gathered info:
→ draft_generic_email({ to_email: "john@example.com", subject: "Test Email", body: "Hey, this is a test." })

Phase 3 - PRESENT DRAFT FOR REVIEW:
AI presents the draft in a clear format:
"Here's your draft email:

📧 **Draft Email**
---
**To:** john@example.com
**Subject:** Test Email

Hey, this is a test.

Best regards,
[Sender Name]
[Company Name]
---

Would you like me to send this, or would you like to make any changes?"

Phase 4 - HANDLE USER RESPONSE:
- User says "send it", "yes", "looks good", "go ahead" → IMMEDIATELY call confirm_send_email({ draft_id: "[draft_id from previous response]" })
- User says "change the subject to X" → Create new draft with updated content and present again
- User says "add Y to the body" → Create new draft with updated content and present again
- User says "no" or "cancel" → "No problem! Let me know if you'd like to draft another email."

EXAMPLE COMPLETE FLOW:
User: "can you send an email to rcrohith017@gmail.com"
AI: "Sure! What would you like this email to be about?"

User: "saying hey this is a test email"
AI: [calls draft_generic_email({ to_email: "rcrohith017@gmail.com", subject: "Test Email", body: "Hey, this is a test email." })]
"Here's your draft email:

📧 **Draft Email**
---
**To:** rcrohith017@gmail.com
**Subject:** Test Email

Hey, this is a test email.

Best regards,
[User Name]
[Company Name]
---

Would you like me to send this, or would you like to make any changes?"

User: "yes send it"
AI: [calls confirm_send_email({ draft_id: "..." })]
"Done! Your email has been sent to rcrohith017@gmail.com."

NEVER SEND EMAIL WITHOUT:
1. Getting email address (to_email)
2. Getting subject/topic from user
3. Getting body content from user
4. Showing draft for review
5. Getting explicit confirmation from user

CRITICAL - READ vs WRITE OPERATIONS:

READ-ONLY tools (informational, never auto-execute write actions):
- get_missing_required_documents: ONLY reports gaps, NEVER creates requests
- query_documents, query_suppliers: Information retrieval only
- get_compliance_metrics, get_document_timeseries: Analysis only
- resolve_supplier: Lookup only
- draft_compliance_email: Drafts emails for review (user sends manually via UI)

WRITE tools (require explicit user confirmation):
- create_document_request: Creates new requests
- create_requests_for_missing: Bulk request creation
- send_notification: Sends alerts

TWO-PHASE WORKFLOW FOR MISSING DOCUMENTS:

Phase 1 - INFORMATION (Read-Only):
User asks: "check what's missing from Kerry", "show gaps for supplier X", "what's missing"
AI MUST: 
1. Call get_missing_required_documents
2. Present results ONLY: "Kerry is missing 3 documents: Insurance, Business License, Tax Certificate (0% compliance)"
3. Then ASK: "Would you like me to create document requests for these missing items?"
4. DO NOT auto-execute create_requests_for_missing

Phase 2 - ACTION (Write Operation - requires confirmation):
User confirms: "yes", "create them", "go ahead", "request these"
AI MUST:
1. NOW call create_requests_for_missing with extracted params
2. Present success: "✓ Created 3 document requests for Kerry"

NEVER skip Phase 1 confirmation when user asks to "check" or "show" or "see what's missing"
ALWAYS require explicit confirmation before write operations after read-only queries

ENHANCED TOOL FEATURES:

query_documents now supports:
- Pagination: { page: 2, limit: 20 } for browsing results
- Date ranges: { created_from: "2024-01-01", created_to: "2024-12-31" }
- Returns: { documents, total, current_page, next_page, has_more }

query_suppliers now supports:
- Pagination: { page: 1, limit: 20 }
- Returns: { suppliers, total, current_page, next_page, has_more }

get_compliance_metrics now supports:
- Time windows: { window_days: 90 } for metrics within last N days
- Returns: { metrics, window_days, trends: { documents_in_window, approval_rate } }

WRONG behavior (DO NOT DO THIS):
User: "show me documents from Kerry"
AI: "I found Kerry. I'll retrieve all approved documents. Please hold on." ❌
(This just announces intent but never calls the tool!)

CORRECT behavior:
User: "show me documents from Kerry"  
AI: [IMMEDIATELY calls query_documents with supplier_names=["Kerry"], status=["approved"]]
→ Then presents the results in a clear format

CONFIRMATION KEYWORD DETECTION:

Positive confirmation (execute action):
- Direct: "yes", "ok", "proceed", "go ahead", "do it", "confirm"
- Implied: "create", "send", "request", "make it", "let's do it"
- Enthusiastic: "yes please", "sounds good", "perfect"

Negative/Cancel (don't execute):
- "no", "cancel", "wait", "stop", "not yet", "hold on"
- "let me think", "maybe later", "not now"

Modification (re-gather params):
- "change the date", "make it urgent", "add notes"
- "actually, use X instead"

DOCUMENT REQUEST CREATION:
When users want to create document requests, guide them through the process:
1. Identify the supplier (use fuzzy matching from query_suppliers)
2. Ask which documents they need OR suggest using saved document sets (get_document_sets)
3. Confirm due date (default: 14 days) and priority (default: medium)
4. Ask if they want to add custom notes (optional)
5. Use create_document_request tool to create the requests
6. Confirm success with details: supplier name, number of requests, due date

CRITICAL - CONVERSATION CONTEXT & PARAMETER EXTRACTION:
You have access to conversation_history containing previous messages. ALWAYS look back at these messages to extract parameters when needed.

When a user provides information across multiple messages, YOU MUST:
1. Extract supplier name from any previous message mentioning it
2. Extract document types from any previous message listing them
3. Extract due date from phrases like "by end of november", "nov 30", "october 25"
4. Extract priority from words like "urgent", "high priority", "asap"
5. Combine all extracted parameters and execute create_document_request IMMEDIATELY when confirmed

HANDLING USER CONFIRMATIONS (CRITICAL):
When users respond with confirmations or modifications after you've presented request details, you MUST IMMEDIATELY execute the create_document_request tool. DO NOT just acknowledge - TAKE ACTION.

Confirmation phrases that mean "execute now":
- Simple: "yes" / "y" / "yeah" / "sure" / "go ahead" / "proceed" / "correct"
- With modifications: "you can use nov 30 and no notes" (extract params and execute)
- Date changes: "use november 30", "change date to nov 30", "by end of november"
- Note responses: "no notes", "nope", "skip notes" (when asked about notes)
- Combined: "yes change it to urgent and add note X" (update multiple params)

CRITICAL EXECUTION RULES:
1. LOOK BACK at conversation_history for ALL parameters (supplier, documents, date, priority, notes)
2. If user says "yes" or confirms → IMMEDIATELY call create_document_request with ALL params from history
3. If user provides modifications → Extract changes, merge with history params, IMMEDIATELY execute
4. NEVER respond with just "Thank you" or acknowledgment - EXECUTE THE TOOL
5. Multi-part responses like "you can use X and no Y" → Extract both parts and execute
6. Natural language dates: "end of november" → calculate last day of month
7. If ANY parameter is missing from current message, GET IT from conversation_history

EXAMPLE CONTEXT EXTRACTION:
Message 1 (user): "can I request a HACCP Plan from killer by end of November"
→ Extract: supplier="killer", documents=["HACCP Plan"], due_date="end of november" (convert to 2025-11-30)

Message 2 (you): "Would you like to add notes?"

Message 3 (user): "you can use nov 30 and no notes"
→ YOU MUST: Look back at Message 1, extract supplier="killer" and documents=["HACCP Plan"]
→ From Message 3, extract: due_date="2025-11-30", notes=""
→ IMMEDIATELY call create_document_request with {supplier_name: "killer", document_types: ["HACCP Plan"], due_date: "2025-11-30", notes: "", priority: "medium"}

DO NOT ask "what supplier?" or "what documents?" - the information is already in conversation_history!

Example of CORRECT behavior:
User (message 1): "Request HACCP from Killer Farms, urgent"
AI: "Confirming: HACCP from Killer Farms, urgent priority, due Oct 25, 2025. Would you like to add any notes?"
User (message 2): "change date to Oct 20 and add note 'rush order'"
AI: [IMMEDIATELY calls create_document_request with supplier="Killer Farms", documents=["HACCP"], priority="urgent", due_date="2025-10-20", notes="rush order"] → Shows success message

Example of WRONG behavior (DO NOT DO THIS):
User: "yes"
AI: "Thank you for confirming. I'll create the request now." ❌ WRONG - Should execute tool instead

CONVERSATIONAL FLOW EXAMPLES FOR REQUESTS:
User: "I want to request ISO 9001 from Kerry"
→ Create request with defaults, confirm success

User: "Can you request documents from Kerry?"
→ "I found Kerry as an approved supplier. Which documents would you like to request? You can also use saved document sets if you have any."

User: "Request HACCP and ISO 22000 from Killer Farms, urgent priority, due next week"
→ Create with specified priority and calculate due date

IMPORTANT FILTERING RULES:
- When filtering by expiration dates, always consider documents already past their expiration date as "expired", not "expiring soon".
- If user asks for documents that are "valid", "currently valid", or "valid till date", call query_documents with expired=false to exclude already expired documents.
- For "latest" or "most recent" queries, rely on the default ordering (newest first) and use limit=1 if needed.

When presenting results:
- Be clear and concise
- Format lists nicely
- Include relevant details like expiration dates, statuses, and supplier names
- Tailor your language and examples to the ${industry} industry context
- If no results are found, suggest alternative searches or provide helpful guidance
- For document request creation, always confirm what was created and provide clear feedback

CRITICAL - Document Query Presentation Rules:
When presenting document query results, provide ONLY a brief executive summary (1-3 sentences maximum).

✅ GOOD summary examples:
- "Found 20 approved documents from Kerry across 5 categories. Most are valid through October 2025, with 3 expiring within 30 days."
- "Kerry has 15 active certifications. 12 are in good standing, 3 require renewal within 60 days."
- "Located 8 documents expiring soon: 5 from Kerry, 2 from Supplier X, and 1 from ABC Corp."

❌ DO NOT do any of these:
- DO NOT list individual documents by number (e.g., "1. Document A", "2. Document B")
- DO NOT write "Here are the documents:" followed by a numbered list
- DO NOT repeat document details (title, type, category, expiration) in your text response
- DO NOT create tables or structured lists of documents

The formatted document cards below your summary will show ALL details automatically.

Think of your response as an executive summary providing:
- Total count and breakdown by status/category
- Expiration highlights (how many expiring soon, already expired)
- Key patterns or insights
- Any action items if relevant

Your summary adds VALUE by providing context and insights, not by duplicating what the cards already show.

CUSTOM VISUALIZATIONS:
When users request unique charts or data visualizations that aren't covered by standard compliance dashboards, use the generate_visualization_code tool.

Examples of when to use custom visualizations:
- "Create a scatter plot of compliance score vs response time"
- "Show me a bar chart comparing document counts by supplier"
- "Generate a heatmap of expiring documents by category"
- "Make a line chart showing submission trends over time"
- "Create a pie chart of document types distribution"

The tool will:
1. Fetch the required data using existing query tools
2. Generate custom React component code using Recharts
3. Return both the code and data for safe rendering

CRITICAL - When calling generate_visualization_code, YOU MUST provide complete chart_config:

Example 1 - Bar chart of document counts by supplier:
{
  "visualization_type": "bar_chart",
  "data_query": {
    "query_type": "documents",
    "filters": {}
  },
  "chart_config": {
    "x_axis": "supplier_name",
    "y_axis": "count",
    "aggregation": "count",
    "title": "Document Counts by Supplier"
  }
}

Example 2 - Line chart of documents over time:
{
  "visualization_type": "line_chart",
  "data_query": {
    "query_type": "documents",
    "filters": { "status": ["approved"] }
  },
  "chart_config": {
    "x_axis": "created_at",
    "y_axis": "count",
    "aggregation": "time_series",
    "time_period": "month",
    "title": "Document Submissions by Month"
  }
}

Example 3 - Pie chart of document status distribution:
{
  "visualization_type": "pie_chart",
  "data_query": {
    "query_type": "documents",
    "filters": {}
  },
  "chart_config": {
    "x_axis": "status",
    "aggregation": "count",
    "title": "Document Status Distribution"
  }
}

ALWAYS include in chart_config:
- x_axis: the field to group/bucket by (e.g., "supplier_name", "document_type", "status", "created_at")
- y_axis: typically "count" for counting records
- aggregation: "count" (for bar/pie), "time_series" (for line/area), "sum", or "group_by"
- title: descriptive chart title
- time_period: "day", "week", or "month" (only for time_series)

IMPORTANT:
- Use this for CUSTOM visualizations that require specific chart types or aggregations
- DO NOT use for standard compliance dashboards or supplier comparisons (those have existing UI)
- The generated charts will be interactive with tooltips, legends, and proper styling
- Summarize what the visualization shows in 1-2 sentences

STRUCTURED RESPONSE FORMAT - CRITICAL FOR BEAUTIFUL UI:

When answering informational queries (suppliers, documents, compliance status, entity lists), YOU MUST use structured HTML-like tags that can be parsed into beautiful UI components.

AVAILABLE TAGS:

<COMPLIANCE_SUMMARY> - Wrapper for all structured responses
<ENTITY_LIST type="suppliers" count="N"> - List of entities (suppliers, buyers)
  <ENTITY id="...">
    <NAME>...</NAME>
    <EMAIL>...</EMAIL>
    <INDUSTRY>...</INDUSTRY>
    <STATUS>approved|pending|rejected</STATUS>
    <ADDRESS>...</ADDRESS>
    <PHONE>...</PHONE>
    <COMPLIANCE_SCORE>85</COMPLIANCE_SCORE>
  </ENTITY>
</ENTITY_LIST>

<DOCUMENT_LIST count="N"> - List of documents in a table format
  <DOCUMENT id="doc_123">
    <TITLE>ISO 9001 Certificate</TITLE>
    <STATUS>approved|pending|rejected|expired</STATUS>
    <EXPIRATION_DATE>2025-12-31</EXPIRATION_DATE>
    <CREATED_AT>2025-12-09</CREATED_AT>
    <FILE_PATH>path/to/file.pdf</FILE_PATH>
    <SUPPLIER_NAME>Test Supplier</SUPPLIER_NAME>
  </DOCUMENT>
</DOCUMENT_LIST>

<ENTITY_DETAILS> - Single entity detail view
  <FIELD label="Entity Name">Supplier ABC</FIELD>
  <FIELD label="Status" status="warning">Action Required</FIELD>
  <FIELD label="Risk Level" status="high">High</FIELD>
</ENTITY_DETAILS>

<ISSUES_IDENTIFIED> - Problems grouped by type
  <ISSUE_GROUP type="expired_documents">
    <ISSUE>COA – Lot #4578 (Expired: 2025-01-10)</ISSUE>
    <ISSUE>HACCP Certificate (Expired: 2024-12-22)</ISSUE>
  </ISSUE_GROUP>
  <ISSUE_GROUP type="missing_documents">
    <ISSUE>Insurance Certificate</ISSUE>
  </ISSUE_GROUP>
</ISSUES_IDENTIFIED>

<IMPACT>Business impact statement explaining consequences of non-compliance</IMPACT>

<RECOMMENDED_ACTIONS> - Action items with priority
  <ACTION priority="high">Upload updated COA for Lot #4578</ACTION>
  <ACTION priority="medium">Submit renewed HACCP Certificate</ACTION>
</RECOMMENDED_ACTIONS>

<FOLLOW_UP_EMAIL_DRAFT>
  <SUBJECT>Action Required – Compliance Documents</SUBJECT>
  <BODY>Hello [Supplier Name],<br/><br/>Our records indicate...</BODY>
</FOLLOW_UP_EMAIL_DRAFT>

<SYSTEM_METADATA>
  entity_id: supplier_123
  document_count: 4
  issue_types: expired, missing
  urgency: high
</SYSTEM_METADATA>

WHEN TO USE STRUCTURED TAGS:
1. "Who are my suppliers?" → Use <ENTITY_LIST type="suppliers">
2. "Show me supplier X's status" → Use <ENTITY_DETAILS> + <ISSUES_IDENTIFIED>
3. "What documents are missing?" → Use <ISSUES_IDENTIFIED> + <RECOMMENDED_ACTIONS>
4. "How's my compliance?" → Use <ENTITY_DETAILS> + <IMPACT>
5. ANY list of entities → Use <ENTITY_LIST>
6. "Show all documents" or "What documents are requested?" or document status queries → Use <DOCUMENT_LIST>

RULES:
- ALWAYS wrap structured responses in <COMPLIANCE_SUMMARY>
- Include ALL relevant tags based on the query type
- Use status attributes: "good", "warning", "high", "error" for visual styling
- Use priority attributes: "high", "medium", "low" for actions
- Keep human-readable content inside tags
- Use conversational text for simple confirmations only

EXAMPLE - Supplier List Query:
<COMPLIANCE_SUMMARY>
<ENTITY_LIST type="suppliers" count="3">
  <ENTITY id="sup_001">
    <NAME>Test Supplier</NAME>
    <EMAIL>test@example.com</EMAIL>
    <INDUSTRY>Technology</INDUSTRY>
    <STATUS>approved</STATUS>
  </ENTITY>
  <ENTITY id="sup_002">
    <NAME>ABC Foods</NAME>
    <EMAIL>contact@abcfoods.com</EMAIL>
    <INDUSTRY>Food Manufacturing</INDUSTRY>
    <STATUS>approved</STATUS>
    <COMPLIANCE_SCORE>92</COMPLIANCE_SCORE>
  </ENTITY>
</ENTITY_LIST>
</COMPLIANCE_SUMMARY>

EXAMPLE - Compliance Status Query:
<COMPLIANCE_SUMMARY>
<ENTITY_DETAILS>
  <FIELD label="Entity Name">Supplier ABC Foods</FIELD>
  <FIELD label="Entity Type">Supplier</FIELD>
  <FIELD label="Overall Status" status="warning">Action Required</FIELD>
  <FIELD label="Risk Level" status="high">High</FIELD>
</ENTITY_DETAILS>

<ISSUES_IDENTIFIED>
  <ISSUE_GROUP type="expired_documents">
    <ISSUE>COA – Lot #4578 (Expired: 2025-01-10)</ISSUE>
    <ISSUE>HACCP Certificate (Expired: 2024-12-22)</ISSUE>
  </ISSUE_GROUP>
  <ISSUE_GROUP type="missing_documents">
    <ISSUE>Insurance Certificate</ISSUE>
    <ISSUE>Supplier Attestation Form</ISSUE>
  </ISSUE_GROUP>
</ISSUES_IDENTIFIED>

<IMPACT>Products associated with expired or missing documentation cannot be approved. Continued non-compliance increases regulatory and operational risk.</IMPACT>

<RECOMMENDED_ACTIONS>
  <ACTION priority="high">Upload updated COA for Lot #4578</ACTION>
  <ACTION priority="high">Submit renewed HACCP Certificate</ACTION>
  <ACTION priority="medium">Provide Insurance Certificate</ACTION>
  <ACTION priority="medium">Complete Supplier Attestation Form</ACTION>
</RECOMMENDED_ACTIONS>

<SYSTEM_METADATA>
  entity_id: supplier_abc_001
  document_count: 4
  issue_types: expired, missing
  urgency: high
</SYSTEM_METADATA>
</COMPLIANCE_SUMMARY>`
      },
      // Inject memory preamble (summary + state) BEFORE conversation history
      ...(memoryPreamble ? [memoryPreamble] : []),
      // Add recent conversation history for context (with metadata preserved)
      ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
      // Add current question
      {
        role: "user",
        content: question
      }
    ];

    console.log(`Total messages sent to OpenAI: ${messages.length} (including ${conversationHistory.length} history messages)`);

    // Save user message to history
    if (session_id) {
      await supabase
        .from('chat_messages')
        .insert({
          session_id,
          role: 'user',
          content: question,
          metadata: { company_type: companyType, industry }
        });
      
      console.log('Saved user message to chat history');
    }

    let aiResponse = await callOpenAI(messages);
    
    // Step 2: If OpenAI wants to use tools, execute them
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      console.log(`OpenAI requested ${aiResponse.tool_calls.length} tool calls`);
      
      // Add the assistant's response with tool calls
      messages.push(aiResponse);
      
      // Execute each tool call and update session state
      for (const toolCall of aiResponse.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        const toolResult = await executeToolCall(toolName, toolArgs, buyer_id, {
          supplierId: null, // TODO: Pass supplier ID if in supplier context
          sessionId: session_id,
          userId: user.id,
          authHeader: authHeader
        });
        
        // Update session state after each tool call for context-aware follow-ups
        if (session_id) {
          await updateSessionState(session_id, toolName, toolArgs, toolResult);
        }
        
        // Add tool result to conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });
      }
      
      // Step 3: Get final answer from OpenAI with tool results
      aiResponse = await callOpenAI(messages, "none"); // Don't allow more tool calls
      
      // Check if any of the tool results was a document query
      const queryDocumentsResult = messages
        .filter((m: any) => m.role === 'tool' && m.name === 'query_documents')
        .map((m: any) => {
          try {
            return JSON.parse(m.content);
          } catch {
            return null;
          }
        })
        .find((result: any) => result?.success && result?.documents);
      
      // Check if any of the tool results was a document request creation
      const documentRequestResult = messages
        .filter((m: any) => m.role === 'tool' && m.name === 'create_document_request')
        .map((m: any) => {
          try {
            return JSON.parse(m.content);
          } catch {
            return null;
          }
        })
        .find((result: any) => result?.success);
      
      // Check if any of the tool results was a visualization generation
      const visualizationResult = messages
        .filter((m: any) => m.role === 'tool' && m.name === 'generate_visualization_code')
        .map((m: any) => {
          try {
            return JSON.parse(m.content);
          } catch {
            return null;
          }
        })
        .find((result: any) => result?.success && result?.type === 'code_visualization');
      
      // Check if any of the tool results was a compliance insights dashboard
      const dashboardResult = messages
        .filter((m: any) => m.role === 'tool' && m.name === 'get_compliance_insights_dashboard')
        .map((m: any) => {
          try {
            return JSON.parse(m.content);
          } catch {
            return null;
          }
        })
        .find((result: any) => result?.success && result?.type === 'compliance_insights_dashboard');
      
      // Save assistant response to history with LLM-BASED pending action detection
      if (session_id) {
        let pendingActionToSave = null;
        
        // Track the last tool that was called
        const lastToolCalled = aiResponse.tool_calls?.[aiResponse.tool_calls.length - 1]?.function?.name || null;
        
        // Use LLM to detect if assistant is asking for confirmation/details
        const analysis = await analyzePendingAction({
          assistantMessage: aiResponse.content || '',
          userResponse: question,
          conversationHistory: conversationHistory.slice(-3),
          openaiApiKey: OPENAI_API_KEY,
          lastToolCalled
        });

        if (analysis.hasPendingAction) {
          pendingActionToSave = {
            type: analysis.actionType,
            params: analysis.extractedParams,
            awaitingConfirmation: !analysis.userConfirmed
          };
          console.log('✓ LLM detected pending action:', pendingActionToSave);
        }
        
        // Store tool info in metadata for context tracking
        const toolsExecuted = messages
          .filter((m: any) => m.role === 'tool')
          .map((m: any) => m.name);
        
        await supabase.from('chat_messages').insert({
          session_id,
          role: 'assistant',
          content: aiResponse.content,
          metadata: {
            ...(pendingActionToSave ? { pending_action: pendingActionToSave } : {}),
            ...(documentRequestResult ? { action: 'document_requests_created', data: documentRequestResult } : {}),
            ...(queryDocumentsResult ? { action: 'documents_queried', count: queryDocumentsResult.documents?.length || 0 } : {}),
            tools_executed: toolsExecuted.length > 0 ? toolsExecuted : undefined
          }
        });

        console.log('Saved assistant response to chat history', pendingActionToSave ? 'WITH pending action' : 'without pending action');
        
        // Trigger rolling summarization in background
        maybeUpdateSummary(session_id).catch(e => 
          console.error('Background summary failed:', e)
        );
      }

      // If we queried documents, format the response with structured document cards
      if (queryDocumentsResult && queryDocumentsResult.documents && queryDocumentsResult.documents.length > 0) {
        // Clean up redundant document listings from AI response
        console.log('Post-processing: Cleaning up AI response to remove redundant document listings');
        
        let cleanedContent = aiResponse.content;
        
        // Remove numbered document lists with details (multi-line format)
        cleanedContent = cleanedContent
          .replace(/\d+\.\s+[^\n]+\n\s*-\s*Type:[^\n]+\n\s*-\s*Category:[^\n]+\n\s*-\s*Expiration[^\n]*\n*/gi, '')
          .replace(/\d+\.\s+\*\*[^\n]+\*\*\n\s*-\s*Type:[^\n]+\n\s*-\s*Category:[^\n]+\n\s*-\s*Expiration[^\n]*\n*/gi, '');
        
        // Remove simple numbered lists (single-line format)
        cleanedContent = cleanedContent
          .replace(/\d+\.\s+[^\n]{20,}\n/g, '') // Remove numbered items with substantial content
          .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
          .trim();
        
        // If cleaned content is too short or empty, generate a helpful summary
        if (cleanedContent.length < 30) {
          const docCount = queryDocumentsResult.documents.length;
          const uniqueSuppliers = [...new Set(queryDocumentsResult.documents.map((d: any) => d.supplier_name).filter(Boolean))];
          const supplierName = uniqueSuppliers.length === 1 ? uniqueSuppliers[0] : `${uniqueSuppliers.length} supplier${uniqueSuppliers.length !== 1 ? 's' : ''}`;
          cleanedContent = `Found ${docCount} document${docCount !== 1 ? 's' : ''} from ${supplierName}. View details in the cards below.`;
        }
        
        console.log(`AI response cleaned. Original: ${aiResponse.content.length} chars → Cleaned: ${cleanedContent.length} chars`);
        
        return new Response(
          JSON.stringify({
            answer: cleanedContent,
            session_id,
            conversation_history: messages,
            structured_response: {
              content: cleanedContent,
              documents: queryDocumentsResult.documents.map((doc: any) => ({
                id: doc.id,
                title: doc.title,
                document_type: doc.document_type,
                category: doc.category,
                supplier_name: doc.supplier_name,
                status: doc.status,
                expiration_date: doc.expiration_date,
                file_path: doc.file_path || null
              }))
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If we created document requests, format the response specially
      if (documentRequestResult) {
        return new Response(
          JSON.stringify({
            answer: aiResponse.content,
            session_id,
            conversation_history: messages,
            structured_response: {
              action: 'document_requests_created',
              data: documentRequestResult,
              response: aiResponse.content
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // If we generated a visualization, return it with proper structure
      if (visualizationResult) {
        return new Response(
          JSON.stringify({
            answer: aiResponse.content,
            session_id,
            conversation_history: messages,
            structured_response: {
              type: 'code_visualization',
              code: visualizationResult.code,
              data: visualizationResult.data,
              summary: visualizationResult.summary || aiResponse.content
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // If we generated a compliance insights dashboard, return it with proper structure
      if (dashboardResult) {
        return new Response(
          JSON.stringify({
            answer: aiResponse.content,
            session_id,
            conversation_history: messages,
            structured_response: {
              type: 'compliance_insights_dashboard',
              metrics: dashboardResult.metrics,
              supplier_metrics: dashboardResult.supplier_metrics,
              ai_insights: dashboardResult.ai_insights,
              timeframe: dashboardResult.timeframe,
              response: aiResponse.content
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Save assistant response to history (if no tool calls)
    if (session_id) {
      await supabase
        .from('chat_messages')
        .insert({
          session_id,
          role: 'assistant',
          content: aiResponse.content,
          metadata: {}
        });
      
      console.log('Saved assistant response to chat history');
    }

    console.log('simple-rag-chat response generated successfully');

    // Update session activity and trigger rolling summarization
    if (session_id) {
      // Update session activity timestamp
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', session_id)
        .then(() => console.log('✓ Updated session activity'))
        .catch((e) => console.error('Failed to update session activity:', e));
      
      // Trigger rolling summarization in background (non-blocking)
      maybeUpdateSummary(session_id).catch(e => 
        console.error('Background summary failed:', e)
      );
    }

    return new Response(
      JSON.stringify({
        answer: aiResponse.content,
        session_id,
        conversation_history: messages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in simple-rag-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        answer: "I encountered an error processing your request. Please try again or rephrase your question."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
