# code_review

Rúbrica de revisión para Codex en `licitacion-ai-pro`.

## 1. Qué importa de verdad

Prioridad de revisión:
1. seguridad y deploy seguro,
2. compatibilidad frontend/backend,
3. contrato SSE,
4. robustez del pipeline IA,
5. calidad de código,
6. UX,
7. limpieza y mantenibilidad.

## 2. No hacer reviews cosméticas

Evitar comentarios irrelevantes sobre:
- naming menor sin impacto,
- formato ya cubierto por lint/prettier,
- preferencias personales sin efecto real.

## 3. Detectar especialmente

### Arquitectura
- acoplamiento innecesario,
- lógica de dominio mezclada con UI,
- lógica sensible dispersa entre frontend y edge function,
- duplicación de reglas entre schemas.

### Frontend
- componentes demasiado grandes,
- hooks con demasiadas responsabilidades,
- estados de carga/error pobres,
- regresiones de accesibilidad,
- inconsistencias entre pantallas principales.

### Backend / Edge Function
- cambios peligrosos en auth,
- timeouts no controlados,
- errores no mapeados,
- parsing frágil,
- drift entre schema canónico y schemas frontend.

### Testing
- ausencia de tests para comportamiento cambiado,
- mocks engañosos,
- E2E omitidos donde sí hacen falta,
- cobertura sin valor real.

### CI/CD
- pasos no reproducibles,
- secretos asumidos,
- workflows desalineados con el repo,
- despliegue incompleto entre Vercel y Supabase.

### Limpieza
- imports/exports muertos,
- scripts obsoletos,
- documentación desactualizada,
- flags y variables sin uso,
- restos legacy.

## 4. Cómo reportar

Formato recomendado:
- Severidad: P0 / P1 / P2 / P3
- Área: security / architecture / frontend / backend / tests / ci-cd / docs / cleanup
- Evidencia: archivo(s)
- Riesgo: qué puede romperse
- Acción mínima: qué hacer para cerrar el hallazgo

## 5. Criterio de bloqueo

Bloquear si hay:
- P0 o P1,
- incumplimiento de `RELEASE_GATES_CODEX.md`,
- cambios sensibles sin documentación viva,
- cambios sensibles sin validación suficiente.
