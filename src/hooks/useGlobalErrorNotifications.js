import { useEffect } from "react";
import { toast } from "sonner";
import { createSupportReference } from "../lib/errors/recovery.js";
import { Auth, DB } from "../lib/supabase.js";
import { buildClientEvent, getClientReleaseMetadata, isClientTelemetryEnabled } from "../lib/monitoring/clientTelemetry.js";

export function useGlobalErrorNotifications() {
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const reference = createSupportReference();
      const reason = event?.reason;
      console.error("Ground Control unhandled promise rejection", { reason, reference });
      if (isClientTelemetryEnabled() && Auth.getSession()?.access_token) {
        DB.recordClientEvent(buildClientEvent({
          level: "error",
          category: "unhandled_rejection",
          message: reason?.message || String(reason || "Unhandled background failure"),
          reference,
          route: window.location.pathname,
          ...getClientReleaseMetadata(),
          context: { errorName: reason?.name || "Error" },
        })).catch((telemetryError) => {
          console.warn("Ground Control telemetry could not be recorded", telemetryError);
        });
      }
      toast.error("An unexpected background action failed", {
        description: `Nothing else has been attempted. Retry the action or reload if the problem continues. Reference: ${reference}`,
        duration: 9000,
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);
}
