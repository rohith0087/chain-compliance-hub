import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, Clock, AlertTriangle, TrendingUp, Target } from "lucide-react";

interface DailyInsights {
  priority_score: number;
  key_actions: string[];
  urgent_items: string[];
}

interface DailyInsightsPanelProps {
  insights: DailyInsights;
}

const DailyInsightsPanel: React.FC<DailyInsightsPanelProps> = ({ insights }) => {
  const getPriorityColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getPriorityLabel = (score: number) => {
    if (score >= 80) return 'Low Priority Day';
    if (score >= 60) return 'Moderate Priority';
    return 'High Priority Day';
  };

  const getPriorityIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-success" />;
    if (score >= 60) return <Clock className="h-4 w-4 text-warning" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-4">
      {/* Priority Score Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Priority Level</CardTitle>
          {getPriorityIcon(insights.priority_score)}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getPriorityColor(insights.priority_score)}`}>
            {insights.priority_score}/100
          </div>
          <p className={`text-sm font-medium ${getPriorityColor(insights.priority_score)}`}>
            {getPriorityLabel(insights.priority_score)}
          </p>
        </CardContent>
      </Card>

      {/* Key Actions */}
      {insights.key_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Key Actions for Today</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.key_actions.map((action, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Urgent Items */}
      {insights.urgent_items.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Urgent Items</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {insights.urgent_items.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Badge variant="destructive" className="text-xs">URGENT</Badge>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Productivity Tip */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start space-x-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Daily Tip</p>
              <p className="text-xs text-muted-foreground mt-1">
                {insights.priority_score >= 80 
                  ? "Great job staying on top of compliance! Use today to prepare for upcoming deadlines."
                  : insights.priority_score >= 60
                  ? "Focus on the urgent items first, then tackle pending reviews to improve your score."
                  : "High priority day! Address urgent items immediately and consider delegating routine tasks."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyInsightsPanel;