import { useState, useMemo } from 'react';
import { unwrap } from '../../lib/tracked-field';
import { formatCurrency } from '../../lib/formatters';
import { useHistory } from '../../hooks/useHistory';
import { LicitacionData } from '../../types';
import { cn } from '../../lib/utils';
import {
    Search,
    Calendar,
    DollarSign,
    Filter,
    FileText,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    TrendingUp,
    Building2,
    Loader2,
    X,
} from 'lucide-react';
import { StatCard } from './components/StatCard';
import { HistoryTableRow } from './components/HistoryTableRow';
import { getStatusFromData } from './utils';

interface HistoryViewProps {
    onSelect: (data: LicitacionData, hash?: string) => void;
}

export function HistoryView({ onSelect }: HistoryViewProps) {
    const { items, loading, applyFilters, activeFilters, search, searchQuery, deleteLicitacion, deleting } =
        useHistory();

    const [searchCliente, setSearchCliente] = useState(activeFilters.cliente || '');
    const [fechaDesde, setFechaDesde] = useState(
        activeFilters.fechaDesde ? new Date(activeFilters.fechaDesde).toISOString().split('T')[0] : ''
    );
    const [fechaHasta, setFechaHasta] = useState(
        activeFilters.fechaHasta ? new Date(activeFilters.fechaHasta).toISOString().split('T')[0] : ''
    );
    const [presupuestoMin, setPresupuestoMin] = useState(activeFilters.presupuestoMin?.toString() || '');
    const [presupuestoMax, setPresupuestoMax] = useState(activeFilters.presupuestoMax?.toString() || '');
    const [currentPage, setCurrentPage] = useState(1);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
        setSearchCliente('');
        setFechaDesde('');
        setFechaHasta('');
        setPresupuestoMin('');
        setPresupuestoMax('');
        applyFilters({});
        search('');
        setCurrentPage(1);
    }

    async function handleDelete(hash: string) {
        const success = await deleteLicitacion(hash);
        if (success) setConfirmDelete(null);
    }

    const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
    const paginatedData = items.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const exitosos = useMemo(() => items.filter((d) => getStatusFromData(d.data) === 'COMPLETO').length, [items]);
    const totalPresupuesto = useMemo(
        () => items.reduce((acc, d) => acc + (unwrap(d.data.datosGenerales.presupuesto) || 0), 0),
        [items]
    );

    return (
        <div className="p-6 md:p-8 font-sans animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
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
                            Busca, filtra y gestiona tus licitaciones analizadas
                        </p>
                    </div>
                </header>

                {/* Stats Row */}
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
                        value={
                            loading
                                ? '-'
                                : totalPresupuesto >= 1_000_000
                                  ? `${(totalPresupuesto / 1_000_000).toFixed(1)}M`
                                  : formatCurrency(totalPresupuesto, 'EUR')
                        }
                    />
                </div>

                {/* Search Bar (primary) */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                    <div className="p-4 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                role="searchbox"
                                data-testid="search-input"
                                placeholder="Buscar por título, organismo, cliente, archivo..."
                                value={searchQuery}
                                onChange={(e) => {
                                    search(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full h-10 pl-10 pr-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        search('');
                                        setCurrentPage(1);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label="Limpiar búsqueda"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowAdvancedFilters((v) => !v)}
                            className={cn(
                                'inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
                                showAdvancedFilters || filtersApplied
                                    ? 'border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros
                            {filtersApplied && (
                                <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-brand-600 text-white">
                                    {Object.keys(activeFilters).length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Advanced Filters (collapsible) */}
                    {showAdvancedFilters && (
                        <div className="border-t border-slate-200 dark:border-slate-700">
                            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="cliente"
                                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                                    >
                                        Cliente
                                    </label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="presMin"
                                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                                    >
                                        Presup. mín.
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
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="presMax"
                                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                                    >
                                        Presup. máx.
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
                            </div>
                        </div>
                    )}
                </div>

                {/* Results count */}
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : items.length === 0 ? (
                        'Sin resultados'
                    ) : (
                        `${items.length} resultado${items.length !== 1 ? 's' : ''}`
                    )}
                    {searchQuery && (
                        <span className="text-slate-400 dark:text-slate-500">para &quot;{searchQuery}&quot;</span>
                    )}
                </div>

                {/* Table Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden transition-colors">
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
                                        Estado
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
                                                <p className="text-xs">Intenta con otros criterios de búsqueda</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => (
                                        <HistoryTableRow
                                            key={item.hash}
                                            item={item}
                                            isEven={idx % 2 === 0}
                                            onSelect={() => onSelect(item.data, item.hash)}
                                            onDelete={() => setConfirmDelete(item.hash)}
                                            isDeleting={deleting === item.hash}
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
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                                    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={cn(
                                                    'w-7 h-7 rounded-md text-xs font-medium transition',
                                                    p === currentPage
                                                        ? 'bg-brand-600 text-white'
                                                        : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                )}
                                            >
                                                {p}
                                            </button>
                                        );
                                    } else if (p === currentPage - 2 || p === currentPage + 2) {
                                        return (
                                            <span key={p} className="text-slate-400 text-xs">
                                                ...
                                            </span>
                                        );
                                    }
                                    return null;
                                })}
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

            {/* Delete Confirmation Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm mx-4 w-full animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Eliminar análisis</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Esta acción eliminará permanentemente este análisis y no se puede deshacer.
                        </p>
                        <div className="mt-5 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDelete)}
                                disabled={deleting === confirmDelete}
                                className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {deleting === confirmDelete ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
