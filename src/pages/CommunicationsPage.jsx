import React from "react";
import PageContainer from "../ui/PageContainer.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import Card from "../ui/Card.jsx";
import IntegrationHubCard from "../components/Communications/IntegrationHubCard.jsx";
import PlanFeatureNotice from "../components/PlanFeatureNotice.jsx";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";

export default function CommunicationsPage({ subscription, onOpenSubscription }) {
  const advancedIntegrationsEnabled = hasEntitlement(subscription, ENTITLEMENTS.ADVANCED_INTEGRATIONS);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Communications"
        title="Communications Centre"
        subtitle="Coach messages, referee updates, matchday packs and outbound club communications."
      />

      {advancedIntegrationsEnabled ? (
        <IntegrationHubCard />
      ) : (
        <PlanFeatureNotice
          entitlement={ENTITLEMENTS.ADVANCED_INTEGRATIONS}
          subscription={subscription}
          title="Integration Hub is hidden on this plan"
          description="Core keeps the club's normal coach, referee and matchday communication workflows. Provider integrations and the integration readiness workspace are available from Pro."
          onOpenSubscription={onOpenSubscription}
        />
      )}

      <Card
        eyebrow="Communications Workflow"
        title="Outbound messaging"
        subtitle="This remains the holding area for WhatsApp-ready messages, referee communications and matchday publishing workflows."
      >
        <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-500 ring-1 ring-slate-200">
          Coach Messages still live inside the matchday workspace for now. Once the publishing queue is wired, this page will become the site-wide communication control centre.
        </div>
      </Card>
    </PageContainer>
  );
}
