import React from 'react';
import { Download, Edit2, Save, X } from 'lucide-react';
import { LicitacionData } from '../../../types';
import { exportToExcel, exportToJson } from '../../../lib/export-utils';
import { exportToPDF } from '../../../lib/pdf-export';

interface DashboardActionsProps {
    isEditing: boolean;
    isDirty: boolean;
    onEdit: () => void;
    onCancel: () => void;
    data: LicitacionData;
}

export const DashboardActions: React.FC<DashboardActionsProps> = ({
    isEditing,
    isDirty,
    onEdit,
    onCancel,
    data
}) => {
    return (
        <div className="flex justify-end gap-2">
            {isEditing ? (
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <X size={16} /> Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!isDirty}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={16} /> Guardar Cambios
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Edit2 size={16} /> Editar
                    </button>
                    <div className="relative group">
                        <button
                            type="button"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
                        >
                            <Download size={16} /> Exportar
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 hidden group-hover:block z-10 transition-all">
                            <button
                                type="button"
                                onClick={() => exportToExcel(data, `analisis-${data.datosGenerales.titulo.substring(0, 20)}`)}
                                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                Excel (.xlsx)
                            </button>
                            <button
                                type="button"
                                onClick={() => exportToJson(data, `analisis-${data.datosGenerales.titulo.substring(0, 20)}`)}
                                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                JSON (.json)
                            </button>
                            <button
                                type="button"
                                onClick={() => exportToPDF(data, `analisis-${data.datosGenerales.titulo.substring(0, 20)}`)}
                                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-50"
                            >
                                PDF (.pdf)
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
