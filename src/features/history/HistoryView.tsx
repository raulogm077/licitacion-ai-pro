import React, { useState } from "react";
import { formatCurrency, formatDate } from '../../lib/formatters';
import { useHistory, HistoryItem } from '../../hooks/useHistory';
import { LicitacionData } from '../../types';
import { cn } from "../../lib/utils";
import {
    Search,
    Calendar,
    DollarSign,
    Eye,
    Filter,
    FileText,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    TrendingUp,
    Clock,
    Building2,
    Loader2
} from "lucide-react";

interface HistoryViewProps {
    onSelect: (data: LicitacionData, hash?: string) => void;
}

type AnalysisStatus = "COMPLETO" | "PARCIAL" | "failed" | "desconocido";

function getStatusFromData(data: LicitacionData): AnalysisStatus {
    if (data.workflow?.status === 'failed') return 'failed';
    if (data.workflow?.quality?.overall === 'COMPLETO') return 'COMPLETO';
    if (data.workflow?.quality?.overall === 'PARCIAL') return 'PARCIAL';
    return 'desconocido';
}

function StatusBadge({ estado }: { estado: AnalysisStatus }) {
    const config: Record<
        AnalysisStatus,
        { label: string; icon: React.ReactNode; className: string }
    > = {
        COMPLETO: {
            label: "Exitoso",
            icon: <CheckCircle2 className="w-3.5 h-3.5" />,
            className:
                "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
        },
        failed: {
            label: "Fallido",
            icon: <XCircle className="w-3.5 h-3.5" />,
            className:
                "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
        },
        PARCIAL: {
            label: "Parcial",
            icon: <AlertCircle className="w-3.5 h-3.5" />,
            className:
                "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
        },
        desconocido: {
            label: "Desconocido",
            icon: <Clock className="w-3.5 h-3.5" />,
            className:
                "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        }
    };

    const { label, icon, className } = config[estado];

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                className
            )}
        >
            {icon}
            {label}
        </span>
    );
}

function StatCard({
    icon,
    label,
    value,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    accent?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-xl border p-4 flex items-center gap-3 transition-colors",
                accent
                    ? "bg-brand-600 text-white border-brand-600 dark:bg-brand-700 dark:border-brand-700"
                    : "bg-white text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700"
            )}
        >
            <div
                className={cn(
                    "p-2 rounded-lg",
                    accent ? "bg-white/15 text-white" : "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                )}
            >
                {icon}
            </div>
            <div>
                <p
                    className={cn(
                        "text-xs font-medium",
                        accent ? "text-brand-100" : "text-slate-500 dark:text-slate-400"
                    )}
                >
                    {label}
                </p>
                <p className="text-xl font-bold leading-tight">{value}</p>
            </div>
        </div>
    );
}

function TableRow({
    item,
    isEven,
    onSelect
}: {
    item: HistoryItem;
    isEven: boolean;
    onSelect: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    const estado = getStatusFromData(item.data);

    // Fallback values since metadata/cliente might be missing
    const cliente = item.data.metadata?.cliente || item.data.datosGenerales.organoContratacion || "Desconocido";

    return (
        <tr
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                "transition-colors",
                hovered
                    ? "bg-brand-50/50 dark:bg-slate-700"
                    : isEven
                        ? "bg-white dark:bg-slate-800"
                        : "bg-slate-50/50 dark:bg-slate-800/50"
            )}
        >
            {/* Título */}
            <td className="px-5 py-3.5">
                <div>
                    <p className="font-medium text-slate-900 dark:text-white leading-snug line-clamp-2">
                        {item.data.datosGenerales.titulo}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                        {item.hash.substring(0, 12)}...
                    </p>
                </div>
            </td>

            {/* Cliente */}
            <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                    </div>
                    <span className="text-slate-900 dark:text-slate-200 text-sm leading-snug line-clamp-1">
                        {cliente}
                    </span>
                </div>
            </td>

            {/* Fecha */}
            <td className="px-4 py-3.5 whitespace-nowrap">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-sm">{formatDate(item.timestamp)}</span>
                </div>
            </td>

            {/* Presupuesto */}
            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(item.data.datosGenerales.presupuesto, item.data.datosGenerales.moneda)}
                </span>
            </td>

            {/* Estado */}
            <td className="px-4 py-3.5 text-center">
                <StatusBadge estado={estado} />
            </td>

            {/* Acciones */}
            <td className="px-4 py-3.5 text-center">
                <button
                    onClick={onSelect}
                    aria-label={`Ver detalles de ${item.data.datosGenerales.titulo}`}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 hover:border-brand-600 dark:hover:text-brand-400 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                >
                    <Eye className="w-3.5 h-3.5" />
                    Ver
                </button>
            </td>
        </tr>
    );
}

export function HistoryView({ onSelect }: HistoryViewProps) {
    const { items, loading, applyFilters, activeFilters } = useHistory();

    const [searchCliente, setSearchCliente] = useState(activeFilters.cliente || "");
    const [fechaDesde, setFechaDesde] = useState(activeFilters.fechaDesde ? new Date(activeFilters.fechaDesde).toISOString().split('T')[0] : "");
    const [fechaHasta, setFechaHasta] = useState(activeFilters.fechaHasta ? new Date(activeFilters.fechaHasta).toISOString().split('T')[0] : "");
    const [presupuestoMin, setPresupuestoMin] = useState(activeFilters.presupuestoMin?.toString() || "");
    const [presupuestoMax, setPresupuestoMax] = useState(activeFilters.presupuestoMax?.toString() || "");
    const [currentPage, setCurrentPage] = useState(1);

    const rowsPerPage = 10;
    const filtersApplied = Object.keys(activeFilters).length > 0;

    function handleFiltrar() {
        applyFilters({
            cliente: searchCliente || undefined,
            fechaDesde: fechaDesde ? new Date(fechaDesde).getTime() : undefined,
            fechaHasta: fechaHasta ? new Date(fechaHasta).getTime() : undefined,
            presupuestoMin: presupuestoMin ? Number(presupuestoMin) : undefined,
            presupuestoMax: presupuestoMax ? Number(presupuestoMax) : undefined,
        });
        setCurrentPage(1);
    }

    function handleReset() {
        setSearchCliente("");
        setFechaDesde("");
        setFechaHasta("");
        setPresupuestoMin("");
        setPresupuestoMax("");
        applyFilters({});
        setCurrentPage(1);
    }

    const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
    const paginatedData = items.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const exitosos = items.filter((d) => getStatusFromData(d.data) === "COMPLETO").length;
    const totalPresupuesto = items.reduce(
        (acc, d) => acc + (d.data.datosGenerales.presupuesto || 0),
        0
    );

    return (
        <div className="p-6 md:p-8 font-sans animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* ── Header ── */}
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 text-brand-600 dark:text-brand-400 mb-1">
                            <FileText className="w-5 h-5" />
                            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                Analista de Pliegos
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-balance">
                            Historial de Análisis
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Busca y filtra tus licitaciones pasadas
                        </p>
                    </div>
                </header>

                {/* ── Stats Row ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        icon={<FileText className="w-4 h-4" />}
                        label="Total licitaciones"
                        value={loading ? '-' : items.length}
                        accent
                    />
                    <StatCard
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        label="Análisis exitosos"
                        value={loading ? '-' : exitosos}
                    />
                    <StatCard
                        icon={<TrendingUp className="w-4 h-4" />}
                        label="Tasa de éxito"
                        value={loading || items.length === 0 ? '-' : `${Math.round((exitosos / items.length) * 100)}%`}
                    />
                    <StatCard
                        icon={<DollarSign className="w-4 h-4" />}
                        label="Presupuesto total"
                        value={loading ? '-' : (totalPresupuesto >= 1_000_000
                            ? `€${(totalPresupuesto / 1_000_000).toFixed(1)}M`
                            : formatCurrency(totalPresupuesto, 'EUR'))}
                    />
                </div>

                {/* ── Filter Card ── */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-colors">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        <h2 className="font-semibold text-sm text-slate-900 dark:text-white">
                            Filtros de búsqueda
                        </h2>
                        {filtersApplied && (
                            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                                Activos
                            </span>
                        )}
                    </div>

                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        {/* Cliente */}
                        <div className="lg:col-span-1 space-y-1.5">
                            <label
                                htmlFor="cliente"
                                className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                            >
                                Cliente
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="cliente"
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    value={searchCliente}
                                    onChange={(e) => setSearchCliente(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                                />
                            </div>
                        </div>

                        {/* Fecha desde */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="fechaDesde"
                                className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                            >
                                Fecha desde
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="fechaDesde"
                                    type="date"
                                    value={fechaDesde}
                                    onChange={(e) => setFechaDesde(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                                />
                            </div>
                        </div>

                        {/* Fecha hasta */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="fechaHasta"
                                className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                            >
                                Fecha hasta
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="fechaHasta"
                                    type="date"
                                    value={fechaHasta}
                                    onChange={(e) => setFechaHasta(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                                />
                            </div>
                        </div>

                        {/* Presupuesto mínimo */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="presMin"
                                className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                            >
                                Presupuesto mín.
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="presMin"
                                    type="number"
                                    placeholder="0"
                                    value={presupuestoMin}
                                    onChange={(e) => setPresupuestoMin(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                                />
                            </div>
                        </div>

                        {/* Presupuesto máximo */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="presMax"
                                className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                            >
                                Presupuesto máx.
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    id="presMax"
                                    type="number"
                                    placeholder="Sin límite"
                                    value={presupuestoMax}
                                    onChange={(e) => setPresupuestoMax(e.target.value)}
                                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action buttons row */}
                    <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleFiltrar}
                            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:bg-brand-800 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        >
                            <Filter className="w-4 h-4" />
                            Aplicar filtros
                        </button>
                        {filtersApplied && (
                            <button
                                onClick={handleReset}
                                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                            >
                                Limpiar filtros
                            </button>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin inline-block" />
                            ) : (
                                items.length === 0
                                    ? "Sin resultados"
                                    : `${items.length} resultado${items.length !== 1 ? "s" : ""}`
                            )}
                        </span>
                    </div>
                </div>

                {/* ── Table Card ── */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden transition-colors">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            <h2 className="font-semibold text-sm text-slate-900 dark:text-white">
                                Licitaciones analizadas
                            </h2>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {loading ? "Cargando..." : `${items.length} registros encontrados`}
                        </span>
                    </div>

                    {/* Desktop table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[35%]">
                                        Título
                                    </th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                        Cliente
                                    </th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                        Fecha
                                    </th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                        Presupuesto
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                                        Estado de Análisis
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-16 text-center text-slate-500 dark:text-slate-400"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                                                <p className="font-medium text-sm">Cargando resultados...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedData.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-5 py-16 text-center text-slate-500 dark:text-slate-400"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                                <p className="font-medium">Sin resultados</p>
                                                <p className="text-xs">
                                                    Intenta con otros criterios de búsqueda
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => (
                                        <TableRow
                                            key={item.hash}
                                            item={item}
                                            isEven={idx % 2 === 0}
                                            onSelect={() => onSelect(item.data, item.hash)}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {items.length > rowsPerPage && (
                        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                Página {currentPage} de {totalPages}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() =>
                                        setCurrentPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                                    (p) => {
                                        // Only show nearby pages
                                        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setCurrentPage(p)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-md text-xs font-medium transition",
                                                        p === currentPage
                                                            ? "bg-brand-600 text-white"
                                                            : "border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                    )}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        } else if (p === currentPage - 2 || p === currentPage + 2) {
                                            return <span key={p} className="text-slate-400 text-xs">...</span>
                                        }
                                        return null;
                                    }
                                )}
                                <button
                                    onClick={() =>
                                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                                    }
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    aria-label="Página siguiente"
                                >
                                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
