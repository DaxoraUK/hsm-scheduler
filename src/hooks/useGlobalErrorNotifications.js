import { useEffect } from "react";
import { toast } from "sonner";
import { createSupportReference } from "../lib/errors/recovery.js";

export function useGlobalErrorNotifications() {
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const reference = createSupportReference();
      const reason = event?.reason;
      console.error("Ground Control unhandled promise rejection", { reason, reference });
      toast.error("An unexpected background action failed", {
        description: `Nothing else has been attempted. Retry the action or reload if the problem continues. Reference: ${reference}`,
        duration: 9000,
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);
}
