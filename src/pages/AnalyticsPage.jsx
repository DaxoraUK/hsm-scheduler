import React from "react";
import PageContainer from "../components/ui/PageContainer.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Card from "../components/ui/Card.jsx";

export default function AnalyticsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Analytics"
        title="Analytics"
        subtitle="Pitch usage, parking pressure, referee trends, fixture distribution and operational insights."
      />

      <Card
        eyebrow="Insights"
        title="Analytics dashboard"
        subtitle="This section will become the intelligence layer for Ground Control."
      >
        <div className="text-sm font-medium text-slate-500">
          We’ll move pitch stats, usage analytics and trends into this section.
        </div>
      </Card>
    </PageContainer>
  );
}