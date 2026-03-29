/**
 * Centralized formatting utilities for the application.
 * Ensures usage of 'es-ES' locale across all components.
 */

export const formatCurrency = (amount: number, currency: string = 'EUR'): string => {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: currency || 'EUR',
    }).format(amount);
};

export const formatDate = (timestamp: number | string | Date): string => {
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(timestamp));
};

export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('es-ES').format(value);
};
