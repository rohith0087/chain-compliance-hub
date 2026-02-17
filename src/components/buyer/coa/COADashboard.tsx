import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3, FlaskConical, CalendarClock, FileCheck, Settings2 } from 'lucide-react';
import { COAOverview } from './COAOverview';
import { COASpecEditor } from './COASpecEditor';
import { COAScheduleManager } from './COAScheduleManager';
import { COAResultsView } from './COAResultsView';
import { COAPolicySettings } from './COAPolicySettings';

export function COADashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">COA Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare Certificates of Analysis against your specifications, track allergens, contaminants, and microbiological results.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="specifications" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Specifications
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5">
            <FileCheck className="h-3.5 w-3.5" />
            Results
          </TabsTrigger>
          <TabsTrigger value="policy" className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Policy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <COAOverview />
        </TabsContent>
        <TabsContent value="specifications">
          <COASpecEditor />
        </TabsContent>
        <TabsContent value="schedules">
          <COAScheduleManager />
        </TabsContent>
        <TabsContent value="results">
          <COAResultsView />
        </TabsContent>
        <TabsContent value="policy">
          <COAPolicySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
