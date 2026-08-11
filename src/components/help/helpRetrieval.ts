import { faqCategories } from './helpContent';
import { helpPlainText } from './HelpRichText';

// Lightweight, dependency-free retrieval over the Help Center articles so the
// Compliance AI assistant can ground "how do I…" / product-usage answers in the
// same documentation shown at /help. Keyword overlap scoring is plenty for ~30
// short articles — no embeddings or backend index needed, and helpContent.ts
// stays the single source of truth.

export interface HelpSnippet {
  category: string;
  question: string;
  answer: string; // markup stripped to plain text for the model
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'do', 'does',
  'how', 'what', 'when', 'where', 'why', 'can', 'i', 'my', 'me', 'you', 'your', 'we', 'it',
  'this', 'that', 'with', 'from', 'as', 'at', 'be', 'by', 'if', 'get', 'set', 'up',
]);

const tokenize = (s: string): string[] =>
  s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 1 && !STOPWORDS.has(w)) ?? [];

// Precompute a searchable index once (module load), plain-text answers included.
const INDEX = faqCategories.flatMap((cat) =>
  cat.faqs.map((faq) => {
    const answer = helpPlainText(faq.answer);
    return {
      category: cat.name,
      question: faq.question,
      answer,
      qTokens: new Set(tokenize(faq.question)),
      aTokens: new Set(tokenize(answer)),
    };
  }),
);

/**
 * Returns the most relevant help articles for a query. Question-title matches
 * are weighted higher than body matches. Empty array when nothing meaningfully
 * overlaps, so the assistant isn't fed irrelevant docs.
 */
export function topHelpArticles(query: string, n = 4): HelpSnippet[] {
  const q = tokenize(query);
  if (q.length === 0) return [];
  return INDEX
    .map((entry) => {
      let score = 0;
      for (const t of q) {
        if (entry.qTokens.has(t)) score += 3;
        else if (entry.aTokens.has(t)) score += 1;
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ entry }) => ({ category: entry.category, question: entry.question, answer: entry.answer }));
}
