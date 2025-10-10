/* @ts-nocheck */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Building } from "lucide-react";

interface Props {
  rows?: any[];
}

const ClientPieFromRows: React.FC<Props> = ({ rows }) => {
  const [PieComp, setPieComp] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;
    // Dynamically import chart libs to avoid heavy type analysis during build
    (async () => {
      try {
        await import("chart.js/auto");
        const mod = await import("react-chartjs-2");
        if (mounted) setPieComp(() => mod.Pie);
      } catch (e) {
        console.warn("Chart libraries failed to load", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!Array.isArray(rows) || rows.length === 0 || !PieComp) return null;

  const first = rows[0] || {};
  const nameKey = "company_name" in first ? "company_name" : "name" in first ? "name" : null;
  const countKey = "document_count" in first ? "document_count" : "count" in first ? "count" : null;
  if (!nameKey || !countKey) return null;

  const data = rows
    .map((r) => ({
      label: r[nameKey] || "Unknown Supplier",
      value: Number(r[countKey] || 0),
    }))
    .filter((d) => d.value > 0);

  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);

  const Pie = PieComp;

  return (
    <div className="mt-4 p-6 border rounded-lg bg-card shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Building className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">Documents by Supplier</h4>
        <Badge variant="outline" className="ml-auto text-xs">
          {total} total
        </Badge>
      </div>
      <div className="w-full max-w-md mx-auto">
        <Pie
          data={{
            labels: data.map((d) => d.label),
            datasets: [
              {
                data: data.map((d) => d.value),
                backgroundColor: [
                  "rgba(59,130,246,0.8)",
                  "rgba(16,185,129,0.8)",
                  "rgba(249,115,22,0.8)",
                  "rgba(236,72,153,0.8)",
                  "rgba(139,92,246,0.8)",
                  "rgba(234,179,8,0.8)",
                  "rgba(20,184,166,0.8)",
                ],
                borderWidth: 2,
                borderColor: "#fff",
              },
            ],
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { position: "bottom", labels: { padding: 12, font: { size: 12 } } },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const v = ctx.parsed || 0;
                    const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
                    return `${ctx.label}: ${v} (${pct}%)`;
                  },
                },
              },
            },
          }}
        />
      </div>
      <div className="mt-4 text-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Supplier</th>
              <th className="text-right py-2">Documents</th>
              <th className="text-right py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const pct = total ? ((d.value / total) * 100).toFixed(1) : "0.0";
              return (
                <tr key={i} className="border-b">
                  <td className="py-2">{d.label}</td>
                  <td className="text-right">{d.value}</td>
                  <td className="text-right text-muted-foreground">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientPieFromRows;
