# Audit Assistant Workspace Upgrade

Turn the current generic "Compliance Compass" chat into a real auditor workspace when `industry = 'Auditor'`. Auditors will pick a Client + Engagement, the AI will pull live evidence, plan the audit, draft findings (Indian + global standards), write them to `audit_findings`, and export a PDF audit report.

## 1. New page: `/audit-assistant` (auditor-only workspace)

3-pane layout (replaces ChatPage for auditors; non-auditors keep current ChatPage):

```text
┌──────────────┬───────────────────────────────┬──────────────────┐
│ LEFT          │ CENTER                        │ RIGHT             │
│ Client picker │ Chat (AI Elements)            │ Tabs:             │
│ Engagement    │  - streamed answers           │  • Evidence       │
│   picker      │  - tool cards (findings,      │  • Findings       │
│ Active        │    risk matrix, gaps,         │  • Report preview │
│ context card  │    citations)                 │                   │
│ Quick prompts │  - composer with file upload  │                   │
└──────────────┴───────────────────────────────┴──────────────────┘
```

- Sidebar nav entry "Audit Assistant" replaces "Compliance Compass" (auditor mode only).
- Client picker = connected suppliers; Engagement picker = `document_requests` for that client.
- Active context shown as chips: Client • Engagement • Standard (ISO/SOC2/HACCP/Companies Act 2013/CARO 2020/GST/Income Tax).
- Quick prompts: "Draft engagement plan", "List missing evidence", "Generate findings", "Summarize risks", "Draft management letter".
- Composer accepts PDF/CSV (uploaded to existing storage, passed as ad-hoc context to chat).

## 2. AI backend: new edge function `audit-assistant`

Built on AI SDK + Lovable Gateway (`google/gemini-3-flash-preview`), streaming via `toUIMessageStreamResponse`. Separate from `rag-chat` to keep auditor logic isolated.

System prompt covers:
- Role: senior auditor; tone: precise, evidence-cited.
- Frameworks: ISO 9001/14001/27001, SOC 2, HACCP/GFSI, **Indian: Companies Act 2013, CARO 2020, SA (Standards on Auditing) issued by ICAI, GST, Income Tax Act, SEBI LODR where relevant**.
- Always cite evidence by document title + id; never fabricate.
- Map every recommendation to a control/clause.

### Tools (server-side, AI SDK `tool` + Zod):

| Tool | Purpose |
|------|---------|
| `getClientProfile` | Pull supplier profile, industry, branches, contacts |
| `listEngagements` | Document requests for client |
| `listEvidence` | Approved/pending/expired docs for client+engagement with metadata |
| `getDocumentContent` | Fetch parsed summary/extracted content for one doc |
| `searchKnowledge` | Vector search over `ai_knowledge_entries` for this client |
| `assessRisk` | Compute risk matrix (likelihood × impact) over evidence gaps |
| `createFinding` (`needsApproval: true`) | Insert into `audit_findings` with severity, recommendation, framework ref |
| `listFindings` | Return existing findings for engagement |
| `generateAuditReport` | Trigger PDF export, returns download URL |

`stopWhen: stepCountIs(50)`. Tool results render as structured cards in chat.

## 3. Schema additions (migration)

Extend `audit_findings` (currently 11 cols) with:
- `engagement_id uuid` (FK → `document_requests.id`, nullable)
- `framework text` (e.g., "CARO 2020 §3(ix)", "ISO 27001 A.8.2")
- `clause_reference text`
- `recommendation text`
- `evidence_doc_ids uuid[]` (links to `document_uploads`)
- `status text default 'open'` (open / in_review / accepted / closed)

New table `audit_engagement_summaries` to cache AI-generated engagement plans:
- `engagement_id`, `client_id`, `auditor_user_id`, `plan_md text`, `risk_matrix jsonb`, `generated_at`

Both with proper GRANTs + RLS scoped to auditor's company via `company_users`.

## 4. PDF audit report export

New edge function `generate-audit-report` (Deno + `pdf-lib` via npm) producing a branded report:

1. Cover (client, engagement, auditor, date, framework)
2. Executive summary (AI-generated from findings)
3. Scope & methodology
4. Risk matrix (rendered as table)
5. Findings table (severity, framework ref, recommendation, evidence)
6. Evidence appendix (doc title, status, expiry)
7. Management letter draft

Saved to existing storage bucket, signed URL returned to chat as a downloadable card.

## 5. UI components (new)

- `src/pages/AuditAssistantPage.tsx` — 3-pane workspace
- `src/components/audit/ClientEngagementPicker.tsx`
- `src/components/audit/EvidencePanel.tsx` — list with expiry/status badges (reuses `documentExpiry.ts`)
- `src/components/audit/FindingsPanel.tsx` — inline editor for `audit_findings`
- `src/components/audit/ReportPreviewPanel.tsx` — last-generated report + regenerate
- `src/components/audit/RiskMatrixCard.tsx` — tool-result render
- `src/components/audit/FindingCard.tsx` — tool-result render + "Accept & save" button (handles `needsApproval`)
- AI Elements: install `conversation message prompt-input tool shimmer`; replace bespoke chat primitives in the auditor flow only.

## 6. Routing & gating

- New route `/audit-assistant` in `App.tsx`.
- `BuyerSidebarLayout`: when `isAuditor`, the existing "Compass" entry links here (existing ChatPage stays for non-auditors).
- Workspace profile `auditor` gets `aiAssistantRoute: '/audit-assistant'` flag.

## Technical details

- Reuse `useWorkspaceProfile` and `getWorkspaceProfileForIndustry` for terminology (`Client`, `Engagement`, `Evidence`, `Audit Risk`).
- Reuse `useBuyerSupplierConnections`, `useOnboardingRequests` for pickers; no duplication.
- Chat history: per-engagement thread, persisted in `chat_sessions` + `chat_messages` (already exist), keyed by `engagement_id`. URL `/audit-assistant/:engagementId`.
- Streaming via AI SDK `useChat` + `DefaultChatTransport` to `audit-assistant` edge function.
- File upload in composer goes through existing `secure-document-url` flow, content passed as a `file` part to Gemini.
- All tools enforce auditor → client access via SECURITY DEFINER helper `auditor_can_access_client(client_id)`.
- `verify_jwt`, rate limiting (`_shared/rateLimiter.ts`), CORS — applied to both new edge functions.

## Non-goals
- No changes to non-auditor (`industry != 'Auditor'`) chat experience.
- No new auth/roles; auditor gating remains industry-based.
- No real-time collaboration on findings (single-user editor for v1).
- No standalone "framework Q&A" page — handled inside chat via `searchKnowledge`.

## Files
**New**: `src/pages/AuditAssistantPage.tsx`, `src/components/audit/*` (6 files), `supabase/functions/audit-assistant/index.ts`, `supabase/functions/generate-audit-report/index.ts`, migration for `audit_findings` columns + `audit_engagement_summaries` + `auditor_can_access_client()`.
**Edited**: `src/App.tsx` (route), `src/components/buyer/BuyerSidebarLayout.tsx` (auditor link target), `src/config/workspaceProfiles.ts` (route flag).
