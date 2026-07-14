import { Toaster } from "sonner";
import { AlertTriangle, CheckCircle2, CircleAlert, Info, LoaderCircle } from "lucide-react";

export default function DaxoraToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      expand
      gap={10}
      visibleToasts={5}
      icons={{
        success: <CheckCircle2 size={18} />,
        info: <Info size={18} />,
        warning: <AlertTriangle size={18} />,
        error: <CircleAlert size={18} />,
        loading: <LoaderCircle className="animate-spin" size={18} />,
      }}
      toastOptions={{
        duration: 4800,
        classNames: {
          toast: "daxora-toast",
          title: "daxora-toast-title",
          description: "daxora-toast-description",
          icon: "daxora-toast-icon",
          actionButton: "daxora-toast-action",
          cancelButton: "daxora-toast-cancel",
          closeButton: "daxora-toast-close",
        },
      }}
    />
  );
}
