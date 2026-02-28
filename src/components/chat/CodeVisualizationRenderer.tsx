import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Sparkles, Code2, RefreshCw } from 'lucide-react';

interface CodeVisualizationProps {
  code: string;
  data: any;
  summary: string;
}

// Helper to validate data quality - supports both single and multi-series formats
function validateVisualizationData(data: any): { isValid: boolean; message?: string } {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { isValid: false, message: 'No data available for visualization' };
  }
  
  const hasNames = data.every(item => item.name !== undefined && item.name !== null);
  if (!hasNames) {
    return { isValid: false, message: 'All data items must have a "name" field for labels.' };
  }
  
  const hasNumericData = data.every(item => {
    if (typeof item.value === 'number' || typeof item.count === 'number') return true;
    if (item.data && Array.isArray(item.data)) return true;
    const numericFields = Object.keys(item).filter(key => key !== 'name' && typeof item[key] === 'number');
    return numericFields.length > 0;
  });
  
  if (!hasNumericData) {
    return { isValid: false, message: 'Data items must contain at least one numeric field (value, count, or series data).' };
  }
  
  return { isValid: true };
}

/**
 * Builds a self-contained HTML page that renders the visualization inside
 * a sandboxed iframe. The iframe has `sandbox="allow-scripts"` (no
 * allow-same-origin), so it cannot access the parent DOM, cookies,
 * localStorage, or any auth state.
 */
function buildSandboxHtml(code: string, data: any): string {
  const serializedData = JSON.stringify(data);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: system-ui, sans-serif; background: transparent; }
  #root { width:100%; min-height:200px; }
  .error { color:#dc2626; padding:16px; font-size:14px; }
</style>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/recharts@2/umd/Recharts.js"><\/script>
<script src="https://unpkg.com/sucrase@3/dist/umd/index.js"><\/script>
</head>
<body>
<div id="root"></div>
<script>
(function(){
  try {
    var data = ${serializedData};
    var code = ${JSON.stringify(code)};

    // Transform JSX
    var transformed;
    try {
      transformed = Sucrase.transform(code, { transforms: ['jsx','typescript'], production: true }).code;
    } catch(e) {
      transformed = code;
    }

    var R = Recharts;
    var safeGlobals = {
      React: React,
      ResponsiveContainer: R.ResponsiveContainer,
      BarChart: R.BarChart, LineChart: R.LineChart, AreaChart: R.AreaChart,
      PieChart: R.PieChart, ScatterChart: R.ScatterChart, RadarChart: R.RadarChart,
      ComposedChart: R.ComposedChart,
      Bar: R.Bar, Line: R.Line, Area: R.Area, Pie: R.Pie,
      Scatter: R.Scatter, Radar: R.Radar,
      XAxis: R.XAxis, YAxis: R.YAxis, ZAxis: R.ZAxis,
      CartesianGrid: R.CartesianGrid, Tooltip: R.Tooltip,
      Legend: R.Legend, Cell: R.Cell,
      data: data
    };

    var wrappedCode = "'use strict';\\nvar " +
      Object.keys(safeGlobals).map(function(k){ return k + '=arguments[0].' + k; }).join(',') +
      ';\\n' + transformed + '\\nreturn CustomVisualization;';

    var Component = (new Function(wrappedCode))(safeGlobals);
    ReactDOM.render(React.createElement(Component, { data: data }), document.getElementById('root'));

    // Tell parent the rendered height
    setTimeout(function(){
      var h = document.getElementById('root').scrollHeight;
      parent.postMessage({ type:'viz-height', height: Math.max(h, 200) }, '*');
    }, 300);
  } catch(err) {
    document.getElementById('root').innerHTML =
      '<div class="error">Visualization error: ' +
      (err.message || 'Unknown error').replace(/</g,'&lt;') + '</div>';
    parent.postMessage({ type:'viz-height', height: 80 }, '*');
  }
})();
<\/script>
</body>
</html>`;
}

export function CodeVisualizationRenderer({ code, data, summary }: CodeVisualizationProps) {
  const [showCode, setShowCode] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(350);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const dataValidation = useMemo(() => validateVisualizationData(data), [data]);

  const sandboxHtml = useMemo(() => {
    if (!dataValidation.isValid) return '';
    return buildSandboxHtml(code, data);
  }, [code, data, dataValidation.isValid]);

  const blobUrl = useMemo(() => {
    if (!sandboxHtml) return '';
    const blob = new Blob([sandboxHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [sandboxHtml]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  // Listen for height messages from the sandboxed iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'viz-height' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height + 16);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!dataValidation.isValid) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Custom Visualization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Data Quality Issue:</strong> {dataValidation.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Custom Visualization
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCode(!showCode)}
            className="gap-2"
          >
            <Code2 className="w-4 h-4" />
            {showCode ? 'Hide' : 'Show'} Code
          </Button>
        </div>
        {summary && (
          <p className="text-sm text-muted-foreground mt-2">{summary}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {blobUrl ? (
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <iframe
              ref={iframeRef}
              src={blobUrl}
              sandbox="allow-scripts"
              style={{ width: '100%', height: iframeHeight, border: 'none' }}
              title="Visualization"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <p>Loading visualization...</p>
          </div>
        )}

        {showCode && (
          <div className="mt-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <pre className="text-xs overflow-x-auto">
                <code>{code}</code>
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
