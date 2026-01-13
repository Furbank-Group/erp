import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function Reports() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Reports Dashboard</CardTitle>
          <CardDescription>
            Reporting features will be available in future updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will contain analytics, project summaries, task completion rates,
            and other business intelligence features as the ERP evolves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
