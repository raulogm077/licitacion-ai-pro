import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../../dashboard/Dashboard';
import { LicitacionData } from '../../../types';
import { MemoryRouter } from 'react-router-dom';

// Mock child components to isolate rendering
vi.mock('../../dashboard/RequirementsMatrix', () => ({ RequirementsMatrix: () => <div>Matrix</div> }));

describe('Security (XSS Prevention)', () => {
    it('should render malicious strings as text, not HTML', () => {
        const maliciousData: LicitacionData = {
            metadata: {
                tags: []
            },
            datosGenerales: {
                // The Attack Payload
                titulo: '<script>alert("XSS")</script>',
                presupuesto: 0,
                moneda: 'EUR',
                plazoEjecucionMeses: 0,
                cpv: [],
                organoContratacion: '<img src="x" onerror="alert(1)" />'
            },
            // ... minimal other fields
            criteriosAdjudicacion: { subjetivos: [], objetivos: [] },
            requisitosTecnicos: { funcionales: [], normativa: [] },
            requisitosSolvencia: { economica: {}, tecnica: [] },
            restriccionesYRiesgos: { killCriteria: [], riesgos: [], penalizaciones: [] },
            modeloServicio: { sla: [], equipoMinimo: [] }
        } as unknown as LicitacionData;



        render(
            <MemoryRouter>
                <Dashboard data={maliciousData} onUpdate={vi.fn()} />
            </MemoryRouter>
        );

        // 1. Verify script tag is NOT executed (hard in JSDOM), but check it is present as TEXT
        // screen.getByText finds by *textContent*, meaning it was rendered visible to user
        expect(screen.getAllByText(/<script>alert\("XSS"\)<\/script>/i).length).toBeGreaterThan(0);



        // 3. Ensure no actual script tag exists in DOM with that content
        // (If escaped, it is text inside a div/span, not a <script> element)
        const scripts = document.querySelectorAll('script');
        // JSDOM might have scripts, but none should contain our alert
        scripts.forEach(script => {
            expect(script.innerHTML).not.toContain('alert("XSS")');
        });
    });
});
