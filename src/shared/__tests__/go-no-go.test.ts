/**
 * Contrato del motor de Go/No-Go (ADR-002 Paso 2, Guía §3).
 *
 * El test que no puede caerse es el de la decisión 7.4: **nunca un veredicto
 * sobre un dato que nadie introdujo**. Todo lo demás de este módulo se puede
 * discutir; eso no, porque un «no cumples» inventado sobre un perfil a medias
 * hace que el licitador descarte una licitación a la que sí podía presentarse.
 */

import { describe, it, expect } from 'vitest';

import {
    evaluarGoNoGo,
    familiaCpv,
    mejorVanEmpresa,
    proyectosSimilares,
    vanExigido,
    type PerfilEmpresa,
    type RequisitosPliego,
} from '../go-no-go';

const HOY = new Date('2026-08-07T00:00:00Z');

const perfilCompleto: PerfilEmpresa = {
    ejercicios: [
        { ejercicio: 2025, volumenNegocio: 900_000 },
        { ejercicio: 2024, volumenNegocio: 1_400_000 },
        { ejercicio: 2023, volumenNegocio: 800_000 },
    ],
    proyectos: [{ denominacion: 'Digitalización', cpv: ['72212000-4'], importe: 500_000, fechaFin: '2025-01-01' }],
    acreditaciones: [
        { tipo: 'seguro_rc', importeCobertura: 1_000_000, fechaCaducidad: '2027-01-01' },
        { tipo: 'iso', identificador: 'ISO 9001', fechaCaducidad: '2027-01-01' },
    ],
};

const pliegoCompleto: RequisitosPliego = {
    cifraNegocioAnualMinima: 1_000_000,
    cpv: ['72220000-3'],
    importeMinimoProyectosSimilares: 300_000,
    coberturaSeguroExigida: 600_000,
    certificacionesExigidas: ['ISO 9001'],
};

describe('la regla que no puede caerse: un dato ausente no es un incumplimiento', () => {
    it('con el perfil vacío no emite ningún no_cumple', () => {
        const { veredicto, chequeos } = evaluarGoNoGo(pliegoCompleto, {}, HOY);
        expect(veredicto).toBe('desconocido');
        expect(chequeos.filter((c) => c.estado === 'no_cumple')).toHaveLength(0);
    });

    it('todo no_verificable nombra el campo que falta', () => {
        const { chequeos } = evaluarGoNoGo(pliegoCompleto, {}, HOY);
        for (const chequeo of chequeos.filter((c) => c.estado === 'no_verificable')) {
            expect(chequeo.camposFaltantes?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('agrega los campos que faltan sin repetirlos, para el enlace de completar perfil', () => {
        const { camposFaltantes } = evaluarGoNoGo(pliegoCompleto, {}, HOY);
        expect(camposFaltantes).toContain('perfil.ejercicios.volumenNegocio');
        expect(new Set(camposFaltantes).size).toBe(camposFaltantes.length);
    });

    it('nunca devuelve go si algo quedó sin verificar', () => {
        const perfilSinProyectos: PerfilEmpresa = { ...perfilCompleto, proyectos: [] };
        expect(evaluarGoNoGo(pliegoCompleto, perfilSinProyectos, HOY).veredicto).toBe('desconocido');
    });

    it('un no_cumple manda sobre un no_verificable: estar excluido es información', () => {
        const perfilParcial: PerfilEmpresa = { acreditaciones: [{ tipo: 'iso', identificador: 'ISO 14001' }] };
        expect(evaluarGoNoGo(pliegoCompleto, perfilParcial, HOY).veredicto).toBe('no_go');
    });
});

describe('el cero que no es un cero', () => {
    it('trata cifraNegocioAnualMinima=0 como no declarada, no como «exigen 0 €»', () => {
        // El schema canónico usa safeCoerceNumber(0), así que un requisito
        // ausente llega como 0. Leerlo literalmente daría un «cumples» a
        // cualquiera.
        const { chequeos } = evaluarGoNoGo({ ...pliegoCompleto, cifraNegocioAnualMinima: 0 }, perfilCompleto, HOY);
        const van = chequeos.find((c) => c.id === 'van');
        expect(van?.estado).toBe('no_verificable');
        expect(van?.camposFaltantes).toContain('pliego.cifraNegocioAnualMinima');
    });

    it('un volumen de negocio en cero no acredita solvencia', () => {
        const perfil: PerfilEmpresa = { ...perfilCompleto, ejercicios: [{ ejercicio: 2025, volumenNegocio: 0 }] };
        expect(evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'van')?.estado).toBe(
            'no_verificable'
        );
    });
});

describe('§3.1.1 — VAN', () => {
    it('deriva el VAN exigido del PBL y la duración cuando el pliego no lo declara', () => {
        // 1,5 × (600.000 / 2 años) = 450.000
        expect(vanExigido({ presupuestoBaseLicitacion: 600_000, duracionMeses: 24 })).toBe(450_000);
    });

    it('prefiere el valor explícito del pliego al derivado', () => {
        expect(
            vanExigido({ cifraNegocioAnualMinima: 1_000, presupuestoBaseLicitacion: 600_000, duracionMeses: 24 })
        ).toBe(1_000);
    });

    it('toma el mejor de los tres últimos ejercicios, no el más reciente', () => {
        expect(mejorVanEmpresa(perfilCompleto.ejercicios!)).toBe(1_400_000);
    });

    it('descarta ejercicios fuera de la ventana de tres', () => {
        const conAntiguo = [...perfilCompleto.ejercicios!, { ejercicio: 2019, volumenNegocio: 9_000_000 }];
        expect(mejorVanEmpresa(conAntiguo)).toBe(1_400_000);
    });

    it('el volumen en el ámbito prevalece sobre el total', () => {
        // Usar el total cuando existe el del ámbito infla el cumplimiento: el
        // pliego suele exigir el segundo.
        expect(mejorVanEmpresa([{ ejercicio: 2025, volumenNegocio: 5_000_000, volumenAmbito: 100_000 }])).toBe(100_000);
    });

    it('marca no_cumple y sugiere la mitigación de la Guía', () => {
        const perfil: PerfilEmpresa = { ...perfilCompleto, ejercicios: [{ ejercicio: 2025, volumenNegocio: 10_000 }] };
        const van = evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'van');
        expect(van?.estado).toBe('no_cumple');
        expect(van?.detalle).toContain('UTE');
    });
});

describe('§3.1.2 — seguro de responsabilidad civil', () => {
    it('sin exigencia en el pliego, cumple', () => {
        const chequeo = evaluarGoNoGo(
            { ...pliegoCompleto, coberturaSeguroExigida: null },
            perfilCompleto,
            HOY
        ).chequeos.find((c) => c.id === 'seguro_rc');
        expect(chequeo?.estado).toBe('cumple');
    });

    it('una póliza caducada es no_cumple, no cumple', () => {
        const perfil: PerfilEmpresa = {
            ...perfilCompleto,
            acreditaciones: [{ tipo: 'seguro_rc', importeCobertura: 5_000_000, fechaCaducidad: '2020-01-01' }],
        };
        expect(evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'seguro_rc')?.estado).toBe(
            'no_cumple'
        );
    });

    it('una póliza sin importe declarado no se puede verificar', () => {
        const perfil: PerfilEmpresa = { ...perfilCompleto, acreditaciones: [{ tipo: 'seguro_rc' }] };
        const chequeo = evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'seguro_rc');
        expect(chequeo?.estado).toBe('no_verificable');
        expect(chequeo?.camposFaltantes).toContain('perfil.acreditaciones.importeCobertura');
    });

    it('compara contra la mejor póliza vigente', () => {
        expect(
            evaluarGoNoGo(pliegoCompleto, perfilCompleto, HOY).chequeos.find((c) => c.id === 'seguro_rc')?.estado
        ).toBe('cumple');
    });
});

describe('§3.2.1 — similitud por CPV', () => {
    it('trunca a los tres primeros dígitos', () => {
        expect(familiaCpv('72212000-4')).toBe('722');
        expect(familiaCpv('45')).toBeNull();
    });

    it('empareja por familia y no por código completo', () => {
        // 72212000 y 72220000 son códigos distintos de la misma familia 722:
        // esa es literalmente la presunción legal de similitud.
        const { proyectos } = proyectosSimilares(pliegoCompleto, perfilCompleto);
        expect(proyectos).toHaveLength(1);
    });

    it('sin coincidencia de familia es no_cumple', () => {
        const perfil: PerfilEmpresa = { ...perfilCompleto, proyectos: [{ cpv: ['45000000-7'], importe: 900_000 }] };
        expect(evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'similitud_cpv')?.estado).toBe(
            'no_cumple'
        );
    });

    it('acumula el importe de los proyectos de la familia', () => {
        const perfil: PerfilEmpresa = {
            ...perfilCompleto,
            proyectos: [
                { cpv: ['72212000-4'], importe: 200_000 },
                { cpv: ['72250000-2'], importe: 150_000 },
            ],
        };
        expect(proyectosSimilares(pliegoCompleto, perfil).importeAcumulado).toBe(350_000);
    });

    it('sin umbral en el pliego acredita experiencia pero no inventa el 70 % habitual', () => {
        const chequeo = evaluarGoNoGo(
            { ...pliegoCompleto, importeMinimoProyectosSimilares: null },
            perfilCompleto,
            HOY
        ).chequeos.find((c) => c.id === 'similitud_cpv');
        expect(chequeo?.estado).toBe('cumple');
        expect(chequeo?.detalle).toContain('no fija importe mínimo');
    });

    it('sin CPV en el pliego no se puede verificar', () => {
        const chequeo = evaluarGoNoGo({ ...pliegoCompleto, cpv: [] }, perfilCompleto, HOY).chequeos.find(
            (c) => c.id === 'similitud_cpv'
        );
        expect(chequeo?.estado).toBe('no_verificable');
        expect(chequeo?.camposFaltantes).toContain('pliego.cpv');
    });
});

describe('§3.2.2 — certificaciones', () => {
    it('sin exigencia en el pliego, cumple', () => {
        const chequeo = evaluarGoNoGo(
            { ...pliegoCompleto, certificacionesExigidas: [] },
            perfilCompleto,
            HOY
        ).chequeos.find((c) => c.id === 'certificaciones');
        expect(chequeo?.estado).toBe('cumple');
    });

    it('empareja ignorando mayúsculas, espacios y guiones', () => {
        const perfil: PerfilEmpresa = {
            ...perfilCompleto,
            acreditaciones: [{ tipo: 'iso', identificador: 'iso-9001' }],
        };
        expect(
            evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'certificaciones')?.estado
        ).toBe('cumple');
    });

    it('una certificación caducada cuenta como ausente y es bloqueante', () => {
        // Presentarla acreditaría algo que el órgano rechazaría.
        const perfil: PerfilEmpresa = {
            ...perfilCompleto,
            acreditaciones: [{ tipo: 'iso', identificador: 'ISO 9001', fechaCaducidad: '2020-01-01' }],
        };
        const chequeo = evaluarGoNoGo(pliegoCompleto, perfil, HOY).chequeos.find((c) => c.id === 'certificaciones');
        expect(chequeo?.estado).toBe('no_cumple');
        expect(chequeo?.detalle).toContain('Bloqueante');
    });

    it('nombra exactamente qué certificación falta', () => {
        const chequeo = evaluarGoNoGo(
            { ...pliegoCompleto, certificacionesExigidas: ['ISO 9001', 'ENS-Alto'] },
            perfilCompleto,
            HOY
        ).chequeos.find((c) => c.id === 'certificaciones');
        expect(chequeo?.detalle).toContain('ENS-Alto');
        expect(chequeo?.detalle).not.toContain('ISO 9001');
    });
});

describe('veredicto completo', () => {
    it('go cuando los cuatro chequeos cumplen', () => {
        const resultado = evaluarGoNoGo(pliegoCompleto, perfilCompleto, HOY);
        expect(resultado.veredicto).toBe('go');
        expect(resultado.camposFaltantes).toHaveLength(0);
    });

    it('cada chequeo cita la sección de la Guía que lo define', () => {
        const { chequeos } = evaluarGoNoGo(pliegoCompleto, perfilCompleto, HOY);
        expect(chequeos.map((c) => c.guia)).toEqual(['§3.1.1', '§3.1.2', '§3.2.1', '§3.2.2']);
    });
});
