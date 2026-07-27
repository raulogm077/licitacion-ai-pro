/**
 * Interpretación de las reglas de puntuación económica de un pliego.
 *
 * El pipeline extrae `formula` y `umbralAnormalidad` como texto libre, tal y
 * como aparecen en el pliego. Este módulo los convierte en algo evaluable para
 * poder responder «con este precio, cuántos puntos saco» y «a partir de qué
 * importe entro en baja temeraria».
 *
 * Principio rector: **no adivinar**. Un pliego mal interpretado produce números
 * convincentes y falsos, que es peor que no dar ninguno. Cuando el texto no
 * encaja con un patrón conocido se devuelve un fallo explícito con el motivo, y
 * la interfaz debe decir «no simulable» en vez de inventar una cifra.
 */

/** Fórmulas de precio reconocidas, en forma evaluable. */
export type PriceFormula =
    /** `P × (oferta mínima / oferta analizada)` — proporcionalidad inversa. */
    | { kind: 'inverse_proportional'; maxPoints: number }
    /** `P × (baja de la oferta / baja máxima)` — proporcional a la baja. */
    | { kind: 'proportional_to_drop'; maxPoints: number }
    /** `P × (PBL − oferta) / (PBL − oferta mínima)` — lineal sobre el presupuesto. */
    | { kind: 'linear_to_budget'; maxPoints: number };

export type FormulaParse = { ok: true; formula: PriceFormula } | { ok: false; reason: string };

/** Umbrales de anormalidad reconocidos. */
export type AnomalyThreshold =
    { kind: 'percent_below_mean'; percent: number } | { kind: 'percent_below_budget'; percent: number };

export type ThresholdParse = { ok: true; threshold: AnomalyThreshold } | { ok: false; reason: string };

const NO_FORMULA = 'El pliego no recoge una fórmula de precio.';
const UNKNOWN_FORMULA =
    'La fórmula no coincide con ningún patrón conocido; hay que leerla en el pliego y calcularla a mano.';
const NO_THRESHOLD = 'El pliego no recoge un umbral de baja temeraria.';
const UNKNOWN_THRESHOLD = 'El umbral no coincide con ningún patrón conocido; hay que leerlo en el pliego.';

/**
 * Normaliza el texto para comparar: minúsculas, sin acentos y con los espacios
 * colapsados. Los pliegos escriben lo mismo de muchas maneras («Oferta Mínima»,
 * «oferta más económica», «OFERTA MINIMA») y sin esto habría que multiplicar
 * cada patrón por sus variantes ortográficas.
 */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Primer número del texto, aceptando coma o punto decimal. Se usa para la
 * puntuación máxima («40 x (...)») y para los porcentajes del umbral.
 */
function firstNumber(text: string): number | null {
    const match = text.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const value = Number.parseFloat(match[0].replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}

/** Sinónimos con los que los pliegos nombran la oferta más barata. */
const MIN_BID =
    '(?:oferta\\s+(?:mas\\s+)?(?:minima|baja|economica|ventajosa)|mejor\\s+oferta|menor\\s+oferta|precio\\s+minimo)';
/** Sinónimos de «la oferta que se está puntuando». */
const THIS_BID = '(?:oferta\\s+(?:analizada|valorada|del\\s+licitador|a\\s+valorar)|oferta\\s+i\\b|licitador)';

export function parsePriceFormula(raw: string | null | undefined): FormulaParse {
    if (!raw || !raw.trim()) return { ok: false, reason: NO_FORMULA };

    const text = normalize(raw);
    const maxPoints = firstNumber(text);

    // Proporcionalidad inversa: la familia más común en pliegos españoles.
    // «40 x (oferta mínima / oferta analizada)»
    if (maxPoints !== null && new RegExp(`${MIN_BID}\\s*[/÷]\\s*${THIS_BID}`).test(text)) {
        return { ok: true, formula: { kind: 'inverse_proportional', maxPoints } };
    }

    // Proporcional a la baja: «50 x (baja de la oferta / baja máxima)».
    if (maxPoints !== null && /baja/.test(text) && /baja\s+(?:maxima|mayor|mas\s+alta)/.test(text)) {
        return { ok: true, formula: { kind: 'proportional_to_drop', maxPoints } };
    }

    // Lineal sobre el presupuesto de licitación.
    if (
        maxPoints !== null &&
        /(?:presupuesto|pbl|tipo\s+de\s+licitacion|importe\s+de\s+licitacion)/.test(text) &&
        new RegExp(MIN_BID).test(text)
    ) {
        return { ok: true, formula: { kind: 'linear_to_budget', maxPoints } };
    }

    return { ok: false, reason: UNKNOWN_FORMULA };
}

export function parseAnomalyThreshold(raw: string | null | undefined): ThresholdParse {
    if (!raw || !raw.trim()) return { ok: false, reason: NO_THRESHOLD };

    const text = normalize(raw);
    const percent = firstNumber(text);
    if (percent === null || !/%|por\s?ciento|puntos\s+porcentuales/.test(text)) {
        return { ok: false, reason: UNKNOWN_THRESHOLD };
    }

    if (/media|promedio/.test(text)) {
        return { ok: true, threshold: { kind: 'percent_below_mean', percent } };
    }
    if (/presupuesto|pbl|tipo\s+de\s+licitacion|importe\s+de\s+licitacion|precio\s+de\s+salida/.test(text)) {
        return { ok: true, threshold: { kind: 'percent_below_budget', percent } };
    }

    return { ok: false, reason: UNKNOWN_THRESHOLD };
}

export interface ScoreInput {
    /** Oferta del licitador que simula. */
    bid: number;
    /** Oferta más baja del resto de licitadores; desconocida al decidir precio. */
    bestRivalBid?: number | null;
    /** Presupuesto base de licitación. */
    budget?: number | null;
}

/**
 * Puntuación económica para una oferta concreta.
 *
 * Devuelve `null` cuando faltan datos para calcularla, en vez de asumir un
 * valor. Ese `null` es la señal de que la interfaz debe pedir el dato o decir
 * que no se puede simular.
 */
export function scorePrice(formula: PriceFormula, input: ScoreInput): number | null {
    const { bid, bestRivalBid, budget } = input;
    if (!Number.isFinite(bid) || bid <= 0) return null;

    // La oferta ganadora es la más baja entre la propia y la del rival.
    const winning =
        Number.isFinite(bestRivalBid as number) && (bestRivalBid as number) > 0
            ? Math.min(bid, bestRivalBid as number)
            : bid;

    switch (formula.kind) {
        case 'inverse_proportional':
            return round2(formula.maxPoints * (winning / bid));

        case 'proportional_to_drop': {
            if (!Number.isFinite(budget as number) || (budget as number) <= 0) return null;
            const base = budget as number;
            const ownDrop = base - bid;
            const maxDrop = base - winning;
            if (ownDrop <= 0) return 0;
            if (maxDrop <= 0) return null;
            return round2(formula.maxPoints * (ownDrop / maxDrop));
        }

        case 'linear_to_budget': {
            if (!Number.isFinite(budget as number) || (budget as number) <= 0) return null;
            const base = budget as number;
            const span = base - winning;
            if (span <= 0) return null;
            return round2(formula.maxPoints * ((base - bid) / span));
        }
    }
}

export interface AnomalyContext {
    budget?: number | null;
    /** Media de las ofertas admitidas, si se conoce. */
    averageBid?: number | null;
}

/**
 * Importe por debajo del cual la oferta se consideraría anormalmente baja.
 *
 * `null` cuando el umbral depende de un dato que aún no existe — típicamente la
 * media de las ofertas, que no se conoce hasta la apertura de plicas. Eso no es
 * un fallo: es información honesta de que ese umbral no se puede anticipar.
 */
export function anomalyLimit(threshold: AnomalyThreshold, ctx: AnomalyContext): number | null {
    const factor = 1 - threshold.percent / 100;

    if (threshold.kind === 'percent_below_budget') {
        if (!Number.isFinite(ctx.budget as number) || (ctx.budget as number) <= 0) return null;
        return round2((ctx.budget as number) * factor);
    }

    if (!Number.isFinite(ctx.averageBid as number) || (ctx.averageBid as number) <= 0) return null;
    return round2((ctx.averageBid as number) * factor);
}

export interface SimulationPoint {
    /** Oferta ganadora asumida para este punto de la curva. */
    winningBid: number;
    points: number;
}

/**
 * Curva de puntuación frente a la oferta ganadora asumida.
 *
 * Es la forma honesta de presentar la simulación: el licitador no conoce la
 * oferta más baja de sus rivales, así que un número único sería falsa
 * precisión. La curva enseña cuánto le penaliza cada escenario.
 */
export function simulateAgainstRivals(
    formula: PriceFormula,
    bid: number,
    budget: number | null | undefined,
    rivalBids: number[]
): SimulationPoint[] {
    return rivalBids
        .filter((rival) => Number.isFinite(rival) && rival > 0)
        .map((rival) => ({
            winningBid: Math.min(bid, rival),
            points: scorePrice(formula, { bid, bestRivalBid: rival, budget }),
        }))
        .filter((point): point is SimulationPoint => point.points !== null);
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
