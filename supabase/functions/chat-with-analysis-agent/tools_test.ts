import { assertEquals, assertObjectMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractEvidence,
  normalizeFieldValue,
  resolveFieldPath,
  searchInObject,
} from './tools.ts';

Deno.test('resolveFieldPath reads nested values', () => {
  const data = {
    datosGenerales: {
      titulo: { value: 'Contrato de limpieza', status: 'extraido' },
    },
  };

  const value = resolveFieldPath(data, 'datosGenerales.titulo');
  assertEquals(value, { value: 'Contrato de limpieza', status: 'extraido' });
});

Deno.test('normalizeFieldValue unwraps tracked field metadata', () => {
  const normalized = normalizeFieldValue({
    value: 120000,
    status: 'extraido',
    warnings: [],
  });

  assertEquals(normalized, {
    value: 120000,
    status: 'extraido',
    warnings: [],
  });
});

Deno.test('extractEvidence merges tracked evidence and workflow evidence', () => {
  const data = {
    result: {
      datosGenerales: {
        presupuesto: {
          value: 120000,
          status: 'extraido',
          evidence: {
            quote: 'Presupuesto base de licitación: 120.000 EUR',
            pageHint: '12',
            confidence: 0.91,
          },
        },
      },
    },
    workflow: {
      evidences: [
        {
          fieldPath: 'datosGenerales.presupuesto',
          quote: 'Presupuesto base de licitación: 120.000 EUR',
          pageHint: '12',
          confidence: 0.91,
        },
        {
          fieldPath: 'datosGenerales.presupuesto',
          quote: 'El valor estimado del contrato asciende a 120.000 EUR',
          pageHint: '13',
          confidence: 0.72,
        },
      ],
    },
  };

  const citations = extractEvidence(data, 'datosGenerales.presupuesto');

  assertEquals(citations.length, 2);
  assertObjectMatch(citations[0], {
    fieldPath: 'datosGenerales.presupuesto',
    quote: 'Presupuesto base de licitación: 120.000 EUR',
    pageHint: '12',
  });
});

Deno.test('searchInObject returns matching leaf paths', () => {
  const data = {
    criteriosAdjudicacion: {
      objetivos: [
        {
          descripcion: 'Oferta económica',
          formula: 'Mayor puntuación a la oferta más baja',
        },
      ],
    },
  };

  const matches = searchInObject(data, 'oferta baja');

  assertEquals(matches.length, 1);
  assertEquals(
    matches[0]?.fieldPath,
    'criteriosAdjudicacion.objetivos.0.formula'
  );
});
