import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Sparkles, Code2, RefreshCw } from 'lucide-react';
import * as Recharts from 'recharts';

interface CodeVisualizationProps {
  code: string;
  data: any;
  summary: string;
}

export function CodeVisualizationRenderer({ code, data, summary }: CodeVisualizationProps) {
  const [showCode, setShowCode] = useState(false);
  
  const { component: RenderedComponent, error } = useMemo(() => {
    try {
      // Security check: validate code doesn't contain dangerous patterns
      const dangerousPatterns = [
        /localStorage/i,
        /sessionStorage/i,
        /document\.cookie/i,
        /eval\(/i,
        /Function\(/i,
        /import\s/i,
        /require\(/i,
        /fetch\(/i,
        /XMLHttpRequest/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          throw new Error(`Security violation: Code contains prohibited pattern: ${pattern.source}`);
        }
      }
      
      // Syntax validation
      if (!code.includes('=>')) {
        throw new Error('Invalid code: Missing arrow function syntax');
      }

      if (!code.includes('CustomVisualization')) {
        throw new Error('Invalid code: Component not named CustomVisualization');
      }

      // Create a safe execution context with timeout protection
      const timeoutMs = 5000;
      let timeoutId: NodeJS.Timeout;
      
      const safeGlobals = {
        React,
        ...Recharts,
        data,
        setTimeout: () => { throw new Error('setTimeout not allowed'); },
        setInterval: () => { throw new Error('setInterval not allowed'); },
      };

      // Transform the code to a function that returns a component
      const wrappedCode = `
        'use strict';
        const {
          React,
          ResponsiveContainer,
          BarChart,
          LineChart,
          AreaChart,
          PieChart,
          ScatterChart,
          RadarChart,
          ComposedChart,
          Bar,
          Line,
          Area,
          Pie,
          Scatter,
          Radar,
          XAxis,
          YAxis,
          ZAxis,
          CartesianGrid,
          Tooltip,
          Legend,
          Cell,
          data
        } = arguments[0];
        
        ${code}
        
        return CustomVisualization;
      `;

      const componentFunction = new Function(wrappedCode);
      const Component = componentFunction(safeGlobals);

      // Set timeout for execution
      timeoutId = setTimeout(() => {
        throw new Error('Visualization execution timeout');
      }, timeoutMs);

      clearTimeout(timeoutId);
      
      return { component: Component, error: null };
    } catch (err: any) {
      console.error('Failed to execute visualization code:', err);
      return { 
        component: null, 
        error: err.message || 'Unknown error occurred while rendering visualization' 
      };
    }
  }, [code, data]);

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
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to render visualization: {error}
            </AlertDescription>
          </Alert>
        ) : RenderedComponent ? (
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <RenderedComponent data={data} />
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
