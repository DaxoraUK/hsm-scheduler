import React from "react";
import PageContainer from "../components/ui/PageContainer.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Card from "../components/ui/Card.jsx";
import IntegrationHubCard from "../components/Communications/IntegrationHubCard.jsx";

export default function CommunicationsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Communications"
        title="Communications Centre"
        subtitle="Coach messages, referee updates, matchday packs and outbound club communications."
      />

      <IntegrationHubCard />

      <Card
        eyebrow="Communications Workflow"
        title="Outbound messaging"
        subtitle="This remains the holding area for WhatsApp-ready messages, referee communications and matchday publishing workflows."
      >
        <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-500 ring-1 ring-slate-200">
          Coach Messages still live inside the matchday workspace for now. Once the publishing queue is wired, this page will become the site-wide communication and integration control centre.
        </div>
      </Card>
    </PageContainer>
  );
}
