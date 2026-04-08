import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChapterRenderer } from '../ChapterRenderer';
import { ChapterConfig } from '../chapter-config';
import { PliegoVM } from '../../../model/pliego-vm';

vi.mock('../FeedbackToggle', () => ({
    FeedbackToggle: ({ fieldPath }: { fieldPath: string }) => <span data-testid={`feedback-${fieldPath}`} />,
}));

vi.mock('../EvidenceToggle', () => ({
    EvidenceToggle: () => <span data-testid="evidence" />,
}));

function mockVM(overrides: Partial<PliegoVM> = {}): PliegoVM {
    return {
        id: 'test',
        result: {
            datosGenerales: {
                titulo: 'Test',
                organoContratacion: 'Org',
                presupuesto: 100000,
                plazoEjecucionMeses: 12,
                cpv: ['123'],
                moneda: 'EUR',
                fechaLimitePresentacion: '2026-01-01',
                duracionContrato: '12 meses',
                valorEstimado: 120000,
            },
            criteriosAdjudicacion: { objetivos: [], subjetivos: [] },
            requisitosSolvencia: { economica: { cifraNegocioAnualMinima: 0, descripcion: '' }, tecnica: [] },
            requisitosTecnicos: { funcionales: [], normativa: [] },
            restriccionesYRiesgos: { riesgos: [], killCriteria: [], penalizaciones: [] },
            modeloServicio: { sla: [], equipoMinimo: [] },
        },
        isAnalysisEmpty: false,
        isIncomplete: false,
        quality: { overall: 'COMPLETO', bySection: {} },
        counts: { riesgos: 0, killCriteria: 0, criterios: 0, requerimientos: 0 },
        display: {
            presupuesto: '100.000 €',
            plazo: '12 meses',
            organo: 'Org',
            cpv: '123',
            titulo: 'Test',
            moneda: 'EUR',
        },
        warnings: [],
        chapters: [
            { id: 'datos', label: 'Datos', status: 'COMPLETO' },
            {
                id: 'criterios',
                label: 'Criterios',
                status: 'VACIO',
                emptyMessage: { title: 'Sin criterios', text: 'No hay criterios' },
            },
        ],
        notas: [],
        citations: [],
        getEvidence: vi.fn().mockReturnValue(undefined),
        isAmbiguous: vi.fn().mockReturnValue(false),
        hash: 'test-hash',
        ...overrides,
    } as unknown as PliegoVM;
}

describe('ChapterRenderer', () => {
    it('renders empty state for VACIO chapter', () => {
        const config: ChapterConfig = {
            id: 'criterios',
            title: 'Criterios',
            subsections: [],
        };
        const vm = mockVM();

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Sin criterios')).toBeInTheDocument();
        expect(screen.getByText('No hay criterios')).toBeInTheDocument();
    });

    it('renders row-table for datos chapter', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Datos Generales',
            subsections: [
                {
                    id: 'rows',
                    dataExtractor: () => [
                        { label: 'Título', value: 'Mi Licitación', fieldPath: 'result.datosGenerales.titulo' },
                        { label: 'CPV', value: '123', fieldPath: 'result.datosGenerales.cpv' },
                    ],
                    fieldPathPrefix: 'result.datosGenerales',
                    renderPattern: 'row-table',
                    itemLabel: (item) => (item as { label: string }).label,
                    itemValue: (item) => (item as { value: string }).value,
                },
            ],
        };
        const vm = mockVM();

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Título')).toBeInTheDocument();
        expect(screen.getByText('Mi Licitación')).toBeInTheDocument();
        expect(screen.getByText('CPV')).toBeInTheDocument();
    });

    it('renders card-list subsection', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Criterios',
            subsections: [
                {
                    id: 'objetivos',
                    title: 'Objetivos',
                    dataExtractor: () => [{ descripcion: 'Precio', ponderacion: 60 }],
                    fieldPathPrefix: 'result.criteriosAdjudicacion.objetivos',
                    renderPattern: 'card-list',
                    itemLabel: (item) => (item as { descripcion: string }).descripcion,
                    itemBadge: (item) => ({
                        text: `${(item as { ponderacion: number }).ponderacion} pts`,
                        variant: 'blue',
                    }),
                    containerClass: 'dot-blue',
                },
            ],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('60 pts')).toBeInTheDocument();
    });

    it('renders simple-list subsection', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Técnicos',
            subsections: [
                {
                    id: 'funcionales',
                    title: 'Funcionales',
                    dataExtractor: () => ['Requisito 1', 'Requisito 2'],
                    fieldPathPrefix: 'result.requisitosTecnicos.funcionales',
                    renderPattern: 'simple-list',
                    itemLabel: (item) => item as string,
                    iconType: 'check',
                },
            ],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Requisito 1')).toBeInTheDocument();
        expect(screen.getByText('Requisito 2')).toBeInTheDocument();
    });

    it('renders chapter title and badge', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Test Title',
            headerBadge: () => ({ text: 'Total: 5' }),
            subsections: [],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Total: 5')).toBeInTheDocument();
    });

    it('skips subsection when data extractor returns empty array', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Vacío',
            subsections: [
                {
                    id: 'empty',
                    title: 'Should Not Render',
                    dataExtractor: () => [],
                    fieldPathPrefix: 'test',
                    renderPattern: 'simple-list',
                    itemLabel: () => '',
                },
            ],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.queryByText('Should Not Render')).not.toBeInTheDocument();
    });

    it('renders risk-list subsection (kill-criteria)', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Riesgos',
            subsections: [
                {
                    id: 'kill',
                    title: 'Criterios Excluyentes',
                    dataExtractor: () => [{ descripcion: 'Kill 1' }],
                    fieldPathPrefix: 'result.restriccionesYRiesgos.killCriteria',
                    renderPattern: 'risk-list',
                    itemLabel: (item) => (item as {descripcion: string}).descripcion,
                    containerClass: 'kill-criteria',
                },
            ],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Criterios Excluyentes')).toBeInTheDocument();
        expect(screen.getByText('Kill 1')).toBeInTheDocument();
    });

    it('renders risk-list subsection (standard risk)', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Riesgos',
            subsections: [
                {
                    id: 'risk',
                    title: 'Riesgos',
                    dataExtractor: () => [{ descripcion: 'Risk 1', impacto: 'CRITICO' }],
                    fieldPathPrefix: 'result.restriccionesYRiesgos.riesgos',
                    renderPattern: 'risk-list',
                    itemLabel: (item) => (item as {descripcion: string}).descripcion,
                },
            ],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('Risk 1')).toBeInTheDocument();
    });

    it('renders key-value-list subsection', () => {
        const config: ChapterConfig = {
            id: 'datos',
            title: 'Key Value',
            subsections: [
                {
                    id: 'kv',
                    title: 'KV Data',
                    dataExtractor: () => [{ key: 'KV Label', val: 'KV Value' }],
                    fieldPathPrefix: 'test',
                    renderPattern: 'key-value-list',
                    itemLabel: (item) => (item as {key: string}).key,
                    itemValue: (item) => (item as {val: string}).val,
                },
            ],
        };
        const vm = mockVM({
            chapters: [{ id: 'datos', label: 'Datos', status: 'COMPLETO' }],
        });

        render(<ChapterRenderer config={config} vm={vm} />);
        expect(screen.getByText('KV Label')).toBeInTheDocument();
        expect(screen.getByText('KV Value')).toBeInTheDocument();
    });
});
