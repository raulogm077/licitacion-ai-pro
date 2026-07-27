import { describe, it, expect } from 'vitest';
import { parsePriceFormula, parseAnomalyThreshold, scorePrice, anomalyLimit, simulateAgainstRivals } from '../scoring';

describe('parsePriceFormula', () => {
    it('reconoce la proporcionalidad inversa de los fixtures reales del benchmark', () => {
        for (const raw of ['40 x (oferta mínima / oferta analizada)', '70 x (oferta mínima / oferta analizada)']) {
            const parsed = parsePriceFormula(raw);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) expect(parsed.formula.kind).toBe('inverse_proportional');
        }
    });

    it('extrae la puntuación máxima de la fórmula', () => {
        const parsed = parsePriceFormula('40 x (oferta mínima / oferta analizada)');
        expect(parsed.ok && parsed.formula.maxPoints).toBe(40);
    });

    it('tolera las variantes ortográficas con las que los pliegos escriben lo mismo', () => {
        const variantes = [
            '55 × (OFERTA MÍNIMA / OFERTA ANALIZADA)',
            '55 x (oferta mas economica / oferta del licitador)',
            '55 x (mejor oferta / oferta valorada)',
        ];
        for (const raw of variantes) {
            const parsed = parsePriceFormula(raw);
            expect(parsed.ok, raw).toBe(true);
            if (parsed.ok) expect(parsed.formula.maxPoints).toBe(55);
        }
    });

    it('reconoce la proporcional a la baja', () => {
        const parsed = parsePriceFormula('50 x (baja de la oferta / baja máxima)');
        expect(parsed.ok && parsed.formula.kind).toBe('proportional_to_drop');
    });

    /**
     * El caso que más importa: preferimos no simular a simular mal. Un número
     * inventado sobre una fórmula no entendida es peor que un «no simulable».
     */
    it('rechaza lo que no entiende en vez de adivinar', () => {
        const noSimulables = [
            'Asignación lineal por compromisos adicionales', // fixture real, no es precio
            'Según el criterio del órgano de contratación',
            'Fórmula recogida en el anexo VII',
            '',
            null,
            undefined,
        ];
        for (const raw of noSimulables) {
            const parsed = parsePriceFormula(raw);
            expect(parsed.ok, String(raw)).toBe(false);
            if (!parsed.ok) expect(parsed.reason.length).toBeGreaterThan(0);
        }
    });
});

describe('parseAnomalyThreshold', () => {
    it('reconoce el umbral del fixture real', () => {
        const parsed = parseAnomalyThreshold('Se considerará temeraria la oferta un 10% inferior a la media.');
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.threshold.kind).toBe('percent_below_mean');
            expect(parsed.threshold.percent).toBe(10);
        }
    });

    it('distingue el umbral contra presupuesto del umbral contra la media', () => {
        const parsed = parseAnomalyThreshold('Ofertas un 25% por debajo del presupuesto base de licitación');
        expect(parsed.ok && parsed.threshold.kind).toBe('percent_below_budget');
    });

    it('acepta decimales con coma', () => {
        const parsed = parseAnomalyThreshold('un 12,5% inferior a la media');
        expect(parsed.ok && parsed.threshold.percent).toBe(12.5);
    });

    it('rechaza un texto sin porcentaje', () => {
        expect(parseAnomalyThreshold('Se valorará según lo previsto en la ley').ok).toBe(false);
    });
});

describe('scorePrice', () => {
    const inversa = { kind: 'inverse_proportional', maxPoints: 40 } as const;

    it('da la puntuación máxima a la oferta más barata', () => {
        expect(scorePrice(inversa, { bid: 100_000, bestRivalBid: 120_000 })).toBe(40);
    });

    it('penaliza proporcionalmente al quedar por encima del rival', () => {
        // 40 × (80.000 / 100.000) = 32
        expect(scorePrice(inversa, { bid: 100_000, bestRivalBid: 80_000 })).toBe(32);
    });

    it('sin rival conocido asume que la propia oferta es la ganadora', () => {
        expect(scorePrice(inversa, { bid: 100_000 })).toBe(40);
    });

    it('devuelve null ante una oferta inválida en vez de un número sin sentido', () => {
        expect(scorePrice(inversa, { bid: 0 })).toBeNull();
        expect(scorePrice(inversa, { bid: -5000 })).toBeNull();
        expect(scorePrice(inversa, { bid: Number.NaN })).toBeNull();
    });

    it('la lineal sobre presupuesto necesita el presupuesto y lo dice con null', () => {
        const lineal = { kind: 'linear_to_budget', maxPoints: 60 } as const;
        expect(scorePrice(lineal, { bid: 90_000, bestRivalBid: 80_000 })).toBeNull();
        // 60 × (100.000 − 90.000) / (100.000 − 80.000) = 30
        expect(scorePrice(lineal, { bid: 90_000, bestRivalBid: 80_000, budget: 100_000 })).toBe(30);
    });

    it('la proporcional a la baja da 0 a quien no baja del presupuesto', () => {
        const baja = { kind: 'proportional_to_drop', maxPoints: 50 } as const;
        expect(scorePrice(baja, { bid: 100_000, bestRivalBid: 90_000, budget: 100_000 })).toBe(0);
    });
});

describe('anomalyLimit', () => {
    it('calcula el límite contra el presupuesto, que se conoce de antemano', () => {
        const threshold = { kind: 'percent_below_budget', percent: 25 } as const;
        expect(anomalyLimit(threshold, { budget: 200_000 })).toBe(150_000);
    });

    /**
     * La media no existe hasta la apertura de plicas. Devolver null es
     * información honesta, no una carencia: ese umbral no se puede anticipar.
     */
    it('no puede anticipar el umbral contra la media si no hay ofertas', () => {
        const threshold = { kind: 'percent_below_mean', percent: 10 } as const;
        expect(anomalyLimit(threshold, { budget: 200_000 })).toBeNull();
        expect(anomalyLimit(threshold, { averageBid: 180_000 })).toBe(162_000);
    });
});

describe('simulateAgainstRivals', () => {
    it('devuelve la curva de puntuación frente a cada escenario de oferta ganadora', () => {
        const inversa = { kind: 'inverse_proportional', maxPoints: 100 } as const;
        const curva = simulateAgainstRivals(inversa, 100_000, null, [120_000, 100_000, 90_000, 80_000]);

        expect(curva).toEqual([
            { winningBid: 100_000, points: 100 }, // el rival es más caro: ganamos
            { winningBid: 100_000, points: 100 }, // empate
            { winningBid: 90_000, points: 90 },
            { winningBid: 80_000, points: 80 },
        ]);
    });

    it('descarta escenarios imposibles en vez de propagarlos', () => {
        const inversa = { kind: 'inverse_proportional', maxPoints: 40 } as const;
        expect(simulateAgainstRivals(inversa, 100_000, null, [0, -1, Number.NaN])).toEqual([]);
    });
});
