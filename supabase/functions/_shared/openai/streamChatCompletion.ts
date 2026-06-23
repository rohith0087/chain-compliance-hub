// Streams an OpenAI chat-completions call and discovers, from the live
// deltas, whether the model is building a tool_calls response (buffered
// silently, returned in the exact shape callOpenAI() already produces, so
// every existing tool-handling code path downstream is unaffected) or a
// plain content response (relayed live to the caller as ndjson
// `{"type":"text_delta","text":"..."}` lines). Either way this is the same
// single OpenAI call a non-streaming request would make -- no doubling.

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}

export type StreamFirstCallResult =
  | { kind: 'tool_calls'; message: OpenAIMessage }
  | { kind: 'content'; readable: ReadableStream<Uint8Array>; whenDone: Promise<string> };

interface OpenAIDelta {
  role?: string;
  content?: string;
  tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

export async function streamFirstCompletion(
  apiKey: string,
  messages: unknown[],
  tools: unknown[],
): Promise<StreamFirstCallResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, tools, tool_choice: 'auto', temperature: 0.7, stream: true }),
  });
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const pullOneDelta = async (): Promise<{ done: true } | { done: false; delta: OpenAIDelta }> => {
    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        const { done, value } = await reader.read();
        if (done) return { done: true };
        buffer += decoder.decode(value, { stream: true });
        continue;
      }
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return { done: true };
      if (!payload) continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta as OpenAIDelta | undefined;
        if (delta) return { done: false, delta };
      } catch {
        // Ignore malformed SSE line; OpenAI occasionally splits frames across reads.
      }
    }
  };

  const toolCallsAcc: OpenAIToolCall[] = [];
  const mergeToolCallDelta = (delta: OpenAIDelta) => {
    for (const tc of delta.tool_calls || []) {
      const index = tc.index ?? 0;
      if (!toolCallsAcc[index]) toolCallsAcc[index] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } };
      if (tc.id) toolCallsAcc[index].id = tc.id;
      if (tc.function?.name) toolCallsAcc[index].function.name += tc.function.name;
      if (tc.function?.arguments) toolCallsAcc[index].function.arguments += tc.function.arguments;
    }
  };

  let decided: 'tool_calls' | 'content' | null = null;
  let contentSoFar = '';

  while (decided === null) {
    const event = await pullOneDelta();
    if (event.done) { decided = 'content'; break; }
    if (event.delta.tool_calls) { decided = 'tool_calls'; mergeToolCallDelta(event.delta); }
    else if (typeof event.delta.content === 'string' && event.delta.content.length > 0) {
      decided = 'content';
      contentSoFar += event.delta.content;
    }
    // role-only / empty deltas: keep waiting for something informative.
  }

  if (decided === 'tool_calls') {
    while (true) {
      const event = await pullOneDelta();
      if (event.done) break;
      if (event.delta.tool_calls) mergeToolCallDelta(event.delta);
      if (typeof event.delta.content === 'string') contentSoFar += event.delta.content;
    }
    return { kind: 'tool_calls', message: { role: 'assistant', content: contentSoFar || null, tool_calls: toolCallsAcc } };
  }

  let resolveWhenDone!: (text: string) => void;
  const whenDone = new Promise<string>((resolve) => { resolveWhenDone = resolve; });

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (text: string) => controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'text_delta', text })}\n`));
      if (contentSoFar) emit(contentSoFar);
      try {
        while (true) {
          const event = await pullOneDelta();
          if (event.done) break;
          if (typeof event.delta.content === 'string' && event.delta.content.length > 0) {
            contentSoFar += event.delta.content;
            emit(event.delta.content);
          }
        }
        resolveWhenDone(contentSoFar);
        controller.close();
      } catch (error) {
        resolveWhenDone(contentSoFar);
        controller.error(error);
      }
    },
  });

  return { kind: 'content', readable, whenDone };
}
