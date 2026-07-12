import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisChatPanel } from '../AnalysisChatPanel';

const { sendMessage } = vi.hoisted(() => ({
    sendMessage: vi.fn(),
}));

vi.mock('../../../../config/service-registry', () => ({
    services: {
        analysisChat: {
            sendMessage,
        },
    },
}));

describe('AnalysisChatPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    });

    it('shows a disabled state when there is no persisted analysis hash', () => {
        render(<AnalysisChatPanel />);

        expect(screen.getByText('Chat no disponible')).toBeInTheDocument();
        expect(screen.getByText(/solo se activa sobre análisis ya persistidos/i)).toBeInTheDocument();
    });

    it('renders the suggested prompts for a persisted analysis', () => {
        render(<AnalysisChatPanel analysisHash="hash-1" analysisTitle="Pliego Demo" />);

        expect(screen.getByText('Copiloto del análisis')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Resume los riesgos principales/i })).toBeInTheDocument();
    });

    it('sends a message and renders the assistant response', async () => {
        sendMessage.mockResolvedValue({
            answer: 'El riesgo principal es la ambigüedad en la solvencia.',
            citations: [{ fieldPath: 'requisitosSolvencia.economica', quote: 'Volumen anual mínimo: 300.000 EUR' }],
            usedTools: ['get_field_evidence'],
            sessionId: '33333333-3333-4333-8333-333333333333',
        });

        render(<AnalysisChatPanel analysisHash="hash-1" analysisTitle="Pliego Demo" />);

        fireEvent.change(screen.getByPlaceholderText(/Pregunta por riesgos/i), {
            target: { value: 'Qué riesgo ves aquí?' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Enviar/i }));

        await waitFor(() => {
            expect(sendMessage).toHaveBeenCalledWith({
                analysisHash: 'hash-1',
                message: 'Qué riesgo ves aquí?',
                sessionId: undefined,
            });
        });

        expect(await screen.findByText('El riesgo principal es la ambigüedad en la solvencia.')).toBeInTheDocument();
        expect(screen.getByText('Volumen anual mínimo: 300.000 EUR')).toBeInTheDocument();
        expect(screen.getByText('get_field_evidence')).toBeInTheDocument();
        expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    it('restores a stored conversation for the same analysis hash', () => {
        vi.mocked(window.localStorage.getItem).mockReturnValue(
            JSON.stringify({
                sessionId: '44444444-4444-4444-8444-444444444444',
                messages: [
                    {
                        id: 'm1',
                        role: 'assistant',
                        content: 'Ya habíamos hablado de este expediente.',
                    },
                ],
            })
        );

        render(<AnalysisChatPanel analysisHash="hash-1" analysisTitle="Pliego Demo" />);

        expect(screen.getByText('Ya habíamos hablado de este expediente.')).toBeInTheDocument();
    });

    it('does not overwrite the stored history of a new hash with the previous hash state', async () => {
        const stored: Record<string, string> = {
            'analysis-chat:hash-1': JSON.stringify({
                sessionId: '44444444-4444-4444-8444-444444444444',
                messages: [{ id: 'm1', role: 'assistant', content: 'Conversación del expediente 1.' }],
            }),
            'analysis-chat:hash-2': JSON.stringify({
                sessionId: '55555555-5555-4555-8555-555555555555',
                messages: [{ id: 'm2', role: 'assistant', content: 'Conversación del expediente 2.' }],
            }),
        };
        vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => stored[key] ?? null);
        vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => {
            stored[key] = value;
        });

        const { rerender } = render(<AnalysisChatPanel analysisHash="hash-1" analysisTitle="Pliego 1" />);
        expect(screen.getByText('Conversación del expediente 1.')).toBeInTheDocument();

        rerender(<AnalysisChatPanel analysisHash="hash-2" analysisTitle="Pliego 2" />);
        await waitFor(() => {
            expect(screen.getByText('Conversación del expediente 2.')).toBeInTheDocument();
        });

        // hash-2's stored history must still contain its own conversation…
        expect(stored['analysis-chat:hash-2']).toContain('Conversación del expediente 2.');
        expect(stored['analysis-chat:hash-2']).not.toContain('Conversación del expediente 1.');
        // …and it must never have been overwritten, not even transiently
        // (the old bug wrote the previous hash's in-memory state and then
        // "self-healed" on the next render — data was lost on unmount).
        expect(window.localStorage.setItem).not.toHaveBeenCalledWith(
            'analysis-chat:hash-2',
            expect.stringContaining('Conversación del expediente 1.')
        );
    });
});
