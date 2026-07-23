// Client wrappers around the `request-ai-assist` edge function.
//
// Every call fails soft: on any error (function not deployed, no AI key,
// model failure) these return `null`, and the caller falls back to its static
// behaviour so the request flow is never blocked by the AI layer.

import { supabase } from '@/integrations/supabase/client';

export interface DocRecommendation { id: string; title: string }

export interface DocRecommendationResult {
  recommendations: DocRecommendation[];
  summary: string;
}

export interface ConfigSuggestion {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueInDays: number;
  rationale: string;
}

interface AvailableDoc { id: string; title: string; category?: string | null }

async function invoke<T>(buyerId: string, task: string, context: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke('request-ai-assist', {
      body: { buyerId, task, context },
    });
    if (error || !data || (data as { error?: string }).error) return null;
    return data as T;
  } catch {
    return null;
  }
}

export function recommendDocuments(
  buyerId: string,
  entityType: string,
  availableDocuments: AvailableDoc[],
): Promise<DocRecommendationResult | null> {
  return invoke<DocRecommendationResult>(buyerId, 'recommend_documents', {
    entityType,
    availableDocuments: availableDocuments.map((d) => ({ id: d.id, title: d.title, category: d.category ?? null })),
  });
}

export function suggestConfig(
  buyerId: string,
  entityType: string,
  selectedDocuments: string[],
  supplierCount: number,
): Promise<ConfigSuggestion | null> {
  return invoke<ConfigSuggestion>(buyerId, 'suggest_config', {
    entityType,
    selectedDocuments,
    supplierCount,
  });
}

export function draftMessage(
  buyerId: string,
  entityType: string,
  selectedDocuments: string[],
  priority: string,
  dueDate: string | null,
): Promise<{ message: string } | null> {
  return invoke<{ message: string }>(buyerId, 'draft_message', {
    entityType,
    selectedDocuments,
    priority,
    dueDate,
  });
}
