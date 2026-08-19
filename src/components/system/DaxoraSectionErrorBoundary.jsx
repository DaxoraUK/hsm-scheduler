import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class DaxoraSectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("[Daxora section recovery]", error, info);
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Section recovery</div>
            <h2 className="mt-1 text-lg font-black text-amber-950">{this.props.title || "This section could not be displayed"}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900/75">{this.props.description || "The rest of the workspace remains available. Retry this section or continue with another area."}</p>
            <button type="button" onClick={() => this.setState({ failed: false })} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-950 px-4 text-xs font-black text-white">
              <RefreshCw size={15} /> Retry section
            </button>
          </div>
        </div>
      </section>
    );
  }
}
