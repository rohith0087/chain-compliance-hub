import { getCorsHeaders } from './corsHeaders.ts';

export interface RequestContext {
  correlationId: string;
  corsHeaders: Record<string, string>;
  startedAt: number;
}

export function createRequestContext(req: Request): RequestContext {
  const incoming = req.headers.get('x-correlation-id')?.trim();
  return {
    correlationId: incoming && incoming.length <= 128 ? incoming : crypto.randomUUID(),
    corsHeaders: getCorsHeaders(req),
    startedAt: Date.now(),
  };
}

export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  context: RequestContext,
  fields: Record<string, unknown> = {},
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    correlation_id: context.correlationId,
    duration_ms: Date.now() - context.startedAt,
    ...fields,
  };
  const serialized = JSON.stringify(entry);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export function jsonResponse(
  context: RequestContext,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...context.corsHeaders,
      'x-correlation-id': context.correlationId,
      ...extraHeaders,
    },
  });
}
