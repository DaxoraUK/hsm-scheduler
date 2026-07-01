import React from "react";
import PageContainer from "../components/ui/PageContainer.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Card from "../components/ui/Card.jsx";

export default function ReportsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        subtitle="Printable documents, exports and matchday packs."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card
          eyebrow="Matchday"
          title="Matchday Pack"
          subtitle="Printable fixture schedule with pitches, referees and timings."
        >
          <div className="mt-4 text-sm font-medium text-slate-500">
            Coming next...
          </div>
        </Card>

        <Card
          eyebrow="Officials"
          title="Referee Report"
          subtitle="Contact details and referee allocations."
        >
          <div className="mt-4 text-sm font-medium text-slate-500">
            Coming next...
          </div>
        </Card>

        <Card
          eyebrow="Export"
          title="CSV & PDF"
          subtitle="Download reports for offline use."
        >
          <div className="mt-4 text-sm font-medium text-slate-500">
            Coming next...
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}