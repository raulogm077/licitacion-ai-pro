import { PliegoVM } from "../../model/pliego-vm";
import { KpiCards } from "../widgets/KpiCards";
import { SummarySection } from "../widgets/SummarySection";
import { AlertsPanel } from "../widgets/AlertsPanel";
import { ScoringChart } from "../widgets/ScoringChart";
import { RiskSummary } from "../widgets/RiskSummary";

export function MainContent({ vm, onNavigate }: { vm: PliegoVM, onNavigate: (section: string) => void }) {
    return (
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
            <div className="p-6 space-y-5 max-w-[1600px] mx-auto animate-fade-in">
                {/* KPI Row */}
                <KpiCards vm={vm} />

                {/* Main grid: summary + alerts */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
                    {/* Left column */}
                    <div className="space-y-5">
                        <SummarySection vm={vm} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <ScoringChart vm={vm} />
                            <RiskSummary vm={vm} />
                        </div>
                    </div>

                    {/* Right column — Alerts */}
                    <div className="xl:min-h-[500px]">
                        <AlertsPanel vm={vm} onNavigate={onNavigate} />
                    </div>
                </div>
            </div>
        </main>
    );
}
