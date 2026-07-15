import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchSupplierRiskGraph, type GraphNode, type RiskGraph } from './scoreApi';

const W = 520;
const H = 380;
const CX = W / 2;
const CY = H / 2;

function nodeColor(n: GraphNode): string {
  if (n.type === 'supplier') return '#0f172a';
  if (n.type === 'source') return '#94a3b8';
  if (n.type === 'entity') return '#3b82f6';
  const sev = n.severity ?? 0.5;
  if (sev >= 0.67) return '#dc2626';
  if (sev >= 0.34) return '#d97706';
  return '#10b981';
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// Dependency-free radial layout: supplier at center, events/entities on an inner
// ring, evidence sources on an outer ring near the event they support.
export function SupplierRiskGraph({ supplierId }: { supplierId: string | null }) {
  const [graph, setGraph] = useState<RiskGraph | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplierId) {
      setGraph(null);
      return;
    }
    setLoading(true);
    fetchSupplierRiskGraph(supplierId)
      .then(setGraph)
      .catch(() => setGraph({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));
  }, [supplierId]);

  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    if (!graph) return pos;
    const supplier = graph.nodes.find((n) => n.type === 'supplier');
    if (supplier) pos.set(supplier.id, { x: CX, y: CY });

    const ring1 = graph.nodes.filter((n) => n.type === 'event' || n.type === 'entity');
    const sources = graph.nodes.filter((n) => n.type === 'source');
    const angleOf = new Map<string, number>();

    ring1.forEach((n, i) => {
      const a = (2 * Math.PI * i) / Math.max(ring1.length, 1) - Math.PI / 2;
      angleOf.set(n.id, a);
      pos.set(n.id, { x: CX + 110 * Math.cos(a), y: CY + 110 * Math.sin(a) });
    });

    sources.forEach((s, i) => {
      const edge = graph.edges.find((ed) => ed.type === 'evidenced_by' && ed.target === s.id);
      let a =
        edge && angleOf.has(edge.source)
          ? (angleOf.get(edge.source) as number)
          : (2 * Math.PI * i) / Math.max(sources.length, 1);
      a += i % 2 === 0 ? 0.14 : -0.14; // separate co-located sources
      pos.set(s.id, { x: CX + 200 * Math.cos(a), y: CY + 200 * Math.sin(a) });
    });

    return pos;
  }, [graph]);

  const empty = !graph || graph.nodes.length <= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk network</CardTitle>
        <CardDescription>
          Supplier → risk events → evidence sources (and ownership, when known).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">No risk connections yet for this supplier.</p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full text-foreground"
            role="img"
            aria-label="Supplier risk network"
          >
            {graph!.edges.map((e, i) => {
              const a = positions.get(e.source);
              const b = positions.get(e.target);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={e.type === 'subject_of' ? '#f87171' : '#cbd5e1'}
                  strokeWidth={1.5}
                  strokeDasharray={e.verified ? undefined : '4 3'}
                />
              );
            })}
            {graph!.nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              const r = n.type === 'supplier' ? 26 : n.type === 'event' ? 16 : 12;
              return (
                <g key={n.id}>
                  <circle cx={p.x} cy={p.y} r={r} fill={nodeColor(n)} opacity={0.9} />
                  <text x={p.x} y={p.y + r + 12} textAnchor="middle" fontSize={10} fill="currentColor">
                    {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend color="#0f172a" label="Supplier" />
          <Legend color="#dc2626" label="Risk event" />
          <Legend color="#94a3b8" label="Source" />
          <Legend color="#3b82f6" label="Related entity" />
          <span>· dashed = inferred</span>
        </div>
      </CardContent>
    </Card>
  );
}
