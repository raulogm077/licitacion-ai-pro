import React from 'react';
import { ReadingMode, READING_MODES } from '../../config/constants';

interface ReadingModeSelectorProps {
    value: ReadingMode;
    onChange: (mode: ReadingMode) => void;
    disabled?: boolean;
}

export const ReadingModeSelector: React.FC<ReadingModeSelectorProps> = ({
    value,
    onChange,
    disabled = false
}) => {
    return (
        <div className="w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Modo de Lectura
            </label>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onChange(READING_MODES.FULL)}
                    disabled={disabled}
                    className={`
                        flex-1 px-4 py-3 rounded-lg border-2 transition-all duration-200
                        ${value === READING_MODES.FULL
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                    `}
                >
                    <div className="flex flex-col items-center">
                        <span className="font-semibold text-sm">📚 Completa</span>
                        <span className="text-xs text-gray-500 mt-1">
                            Análisis exhaustivo
                        </span>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onChange(READING_MODES.KEY_DATA)}
                    disabled={disabled}
                    className={`
                        flex-1 px-4 py-3 rounded-lg border-2 transition-all duration-200
                        ${value === READING_MODES.KEY_DATA
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                    `}
                >
                    <div className="flex flex-col items-center">
                        <span className="font-semibold text-sm">🎯 Datos principales</span>
                        <span className="text-xs text-gray-500 mt-1">
                            Solo info clave
                        </span>
                    </div>
                </button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
                {value === READING_MODES.FULL
                    ? 'Extrae todos los detalles del pliego incluyendo criterios, requisitos y riesgos'
                    : 'Extrae solo presupuesto, plazos, criterios principales y requisitos básicos'
                }
            </p>
        </div>
    );
};
