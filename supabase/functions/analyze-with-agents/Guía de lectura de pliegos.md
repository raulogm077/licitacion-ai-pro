Protocolo Maestro de Ingeniería
Licitatoria: Arquitectura Cognitiva y
Metodológica para el Análisis
Automatizado de Pliegos de
Contratación Pública
1. Introducción: El Paradigma de la Licitación
Computacional
La contratación pública representa uno de los sectores económicos más significativos a nivel
global, movilizando un porcentaje sustancial del Producto Interior Bruto (PIB) de las naciones.
En el contexto español y europeo, este proceso se rige por un marco normativo estricto
—principalmente la Ley 9/2017 de Contratos del Sector Público (LCSP)— que busca garantizar
la transparencia, la libre concurrencia y la eficiencia en el gasto público. Sin embargo, la
complejidad inherente a la documentación que regula estos procesos, materializada en los
pliegos de condiciones, erige una barrera de entrada significativa y genera ineficiencias
operativas críticas para las empresas licitadoras. Tradicionalmente, la interpretación de estos
documentos ha sido una tarea artesanal, dependiente del juicio experto humano y sujeta a
errores de lectura, omisiones de requisitos mandatorios y fallos en la alineación estratégica
de las ofertas.1
La irrupción de la Inteligencia Artificial (IA) y, específicamente, de los Grandes Modelos de
Lenguaje (LLM) y las arquitecturas de Procesamiento de Lenguaje Natural (NLP), plantea un
cambio de paradigma: la transición de una lectura humana secuencial a una extracción,
análisis y síntesis computacional estructurada. Este informe no es meramente una guía de
lectura; es una especificación funcional y ontológica diseñada para instruir a un agente de IA
en la tarea de "deconstruir" una licitación pública. El objetivo no es solo la comprensión
pasiva del texto, sino la habilitación de una capacidad de respuesta activa, donde el agente
pueda identificar riesgos de exclusión (Go/No-Go), extraer la lógica de valoración matemática
y generar una narrativa técnica ("Win Themes") que resuene con las necesidades
subyacentes del órgano de contratación.3
El desafío central para un agente de IA en este dominio no es la falta de información, sino la
dispersión y la jerarquía normativa de la misma. La información crítica para una oferta
ganadora se encuentra fragmentada entre el Pliego de Cláusulas Administrativas Particulares
(PCAP), el Pliego de Prescripciones Técnicas (PPT), los cuadros de características, las
memorias justificativas y los anexos financieros. Además, la interpretación de estos datos

requiere un conocimiento del dominio legal que permita resolver contradicciones aparentes
(antinomiadas) basándose en principios como la jerarquía documental y la especialidad
normativa. Por tanto, esta guía se estructura como un "meta-prompt" o base de conocimiento
contextual, proporcionando al agente las reglas de inferencia necesarias para navegar la
complejidad de la licitación pública con precisión forense.5
A lo largo de este documento, desglosaremos la taxonomía documental, los algoritmos de
decisión para la viabilidad, la ingeniería inversa de los criterios de puntuación y la arquitectura
de datos necesaria para soportar la generación automática de memorias técnicas
competitivas.

2. Taxonomía y Jerarquía Documental: La Ontología
del Expediente
Para que un agente de IA opere con eficacia, primero debe ser capaz de clasificar y ponderar
los documentos que ingesta. En la contratación pública, no todos los documentos tienen el
mismo peso jurídico ni la misma función operativa. El agente debe implementar una lógica de
"prelación documental" para resolver conflictos de información.

2.1 El Pliego de Cláusulas Administrativas Particulares (PCAP): El
Núcleo Jurídico
El PCAP constituye la "ley del contrato" ("Lex Contractus"). Desde una perspectiva
computacional, este documento contiene las reglas de validación (constraints) y la función
objetivo (scoring function) de la licitación. Su primacía es absoluta en aspectos jurídicos,
económicos y administrativos. El agente debe tratar la información extraída del PCAP como la
"Verdad Fundamental" (Ground Truth) en caso de discrepancia con otros documentos, salvo
en cuestiones puramente técnicas donde el PPT podría tener mayor especificidad, aunque
siempre subordinado a las condiciones legales del PCAP.5

2.1.1 Análisis de la Carátula o Cuadro de Características
La mayoría de los PCAP modernos incluyen al inicio un "Cuadro de Características" o
"Carátula". Esta sección es crítica para la extracción rápida de metadatos estructurados. El
agente debe priorizar el escaneo de esta sección para poblar los campos base del
expediente.
●​ Identificadores Únicos: Número de expediente, códigos CPV (Common Procurement
Vocabulary) y códigos NUTS (Nomenclature of Territorial Units for Statistics). La
validación cruzada de los códigos CPV es esencial para determinar la pertinencia de la
licitación frente al objeto social de la empresa.8
●​ Fechas Críticas: Fecha límite de presentación de ofertas, fecha de apertura de sobres, y
plazo de ejecución. El agente debe calcular no solo la fecha límite, sino el "tiempo

efectivo de producción", restando días festivos y tiempos de revisión interna.9

2.1.2 El Régimen Económico y la Estructura de Precios
El agente debe extraer con precisión quirúrgica el Presupuesto Base de Licitación (PBL) y el
Valor Estimado del Contrato (VEC).
●​ Distinción PBL vs. VEC: El PBL (con y sin IVA) es el límite máximo de gasto. El VEC
incluye posibles prórrogas y modificaciones previstas (modificados). Para la IA, el PBL sin
IVA es el límite superior absoluto (Hard Constraint) para la oferta económica. Cualquier
propuesta que supere este valor conlleva la exclusión automática.1
●​ Revisión de Precios: El agente debe buscar cláusulas de revisión de precios. En un
contexto inflacionario, la ausencia de revisión de precios es un indicador de riesgo
financiero alto ("Red Flag") que debe ser reportado al usuario humano.

2.2 El Pliego de Prescripciones Técnicas (PPT): La Definición del
Objeto
Si el PCAP define las reglas, el PPT define el objeto material. Es el documento que detalla el
"qué" y el "cómo". Para la generación de la oferta técnica, el PPT es la fuente primaria de
contenido semántico. El agente debe utilizar el PPT para generar la "Matriz de Cumplimiento"
(Compliance Matrix).7

2.2.1 Funcionalidad vs. Solución
El agente debe distinguir entre requisitos funcionales (qué debe hacer el sistema/servicio) y
requisitos de diseño (cómo debe ser construido).
●​ Prescripciones de Rendimiento: Definidas en términos de resultados (ej. "el sistema
debe soportar 1000 usuarios concurrentes").
●​ Prescripciones Técnicas Específicas: Definidas por normas o estándares (ej. "debe
cumplir la norma UNE-EN ISO 9001"). El agente debe verificar si la empresa dispone de
las certificaciones requeridas o equivalentes.11

2.2.2 El Principio de Neutralidad Tecnológica
La normativa prohíbe, salvo justificación excepcional, la mención de marcas específicas (ej.
"procesadores Intel"). El agente debe detectar menciones a marcas comerciales seguidas o
no de la expresión "o equivalente". Si no aparece "o equivalente", el agente debe marcarlo
como una posible infracción de las normas de libre competencia, lo cual podría ser motivo de
recurso o de una consulta aclaratoria.10

2.3 Documentación Complementaria y Anexos
El análisis no puede limitarse a los dos pliegos principales. La IA debe indexar y correlacionar
información de:

●​ Memoria Justificativa de la Necesidad: Este documento, a menudo ignorado, contiene
la motivación política y estratégica de la contratación. Es una mina de oro para la
extracción de "Win Themes" (Temas Ganadores). Si la memoria menciona "la necesidad
urgente de digitalizar el archivo para mejorar la atención ciudadana", el agente debe
alinear la oferta técnica con los conceptos de "rapidez", "digitalización" y "ciudadanía".12
●​ Documento Europeo Único de Contratación (DEUC): El agente debe ser capaz de
pre-cumplimentar el XML del DEUC con los datos de la empresa y la licitación, ahorrando
una carga administrativa significativa.13

Tabla 1: Matriz de Prioridad y Extracción Documental
Documento

Nivel de
Prioridad
(Jerarquía)

Función
Principal para
el Agente IA

Datos
Críticos a
Extraer
(Entidades)

Acción en
Caso de
Contradicción

PCAP

1 (Máxima)

Reglas de
Validación y
Scoring

PBL, Criterios
de
Adjudicación,
Solvencia,
Penalidades,
Plazos Legales

Prevalece
sobre todos
los demás.

Carátula
(PCAP)

1 (Máxima)

Metadatos
Estructurados

Fechas, CPVs,
Garantías,
Clasificación
Empresarial

Fuente rápida
de verdad.
Verificar
contra el
cuerpo del
PCAP.

PPT

2 (Técnica)

Generación de
Contenido

Requisitos
Funcionales,
SLAs, Equipo
Humano,
Metodología

Prevalece
sobre PCAP
solo en
especificacion
es técnicas
puras.

Memoria
Justificativa

3 (Contextual)

Alineación
Estratégica
(Win Themes)

"Dolores" del
cliente,
Motivación,

Uso para
"Style
Transfer" y

Anexos
Económicos

1 (Económica)

Formato de
Oferta

Objetivos a
largo plazo

persuasión. No
vinculante
jurídicamente.

Cuadros de
precios
unitarios,
Descomposici
ón de costes

Estricto
cumplimiento
de formato.
Riesgo de
exclusión por
error formal.

3. Protocolo de Análisis de Viabilidad (Fase
"Go/No-Go")
El primer servicio de valor que el agente de IA presta no es ayudar a ganar, sino evitar perder
tiempo en oportunidades inviables. El análisis de "Go/No-Go" es un filtro binario basado en
requisitos excluyentes ("Knock-out criteria"). El agente debe realizar este análisis en
segundos tras la ingesta de los documentos.

3.1 Validación de Solvencia Económica y Financiera
La LCSP establece mecanismos precisos para determinar si una empresa tiene "pulmón
financiero" para ejecutar el contrato. El agente debe extraer la cláusula de solvencia
económica del PCAP y compararla con los estados financieros de la empresa licitadora.

3.1.1 Volumen Anual de Negocios (VAN)
Generalmente, se exige un volumen de negocios en el ámbito de la licitación referido al mejor
ejercicio de los últimos tres disponibles.
●​ Regla de Cálculo: $VAN_{exigido} \ge 1.5 \times VAM$ (Valor Anual Medio del contrato).
●​ Lógica del Agente:
1.​ Extraer $VAN_{exigido}$ del PCAP. Si no es explícito, calcular $1.5 \times (PBL /
Duración_{años})$.
2.​ Recuperar $VAN_{empresa}$ de la base de datos interna.
3.​ Evaluar: Si $VAN_{empresa} < VAN_{exigido}$ $\rightarrow$ Alerta Crítica.
4.​ Sugerencia de Mitigación: El agente debe proponer automáticamente la integración
de solvencia externa (medios externos) o la formación de una UTE, identificando el %
de participación necesario para cubrir el gap.14

3.1.2 Seguro de Responsabilidad Civil

Frecuentemente se exige disponer de un seguro de indemnización por riesgos profesionales.
El agente debe verificar el importe de la cobertura exigida frente a la póliza actual de la
empresa.

3.2 Validación de Solvencia Técnica y Profesional
Este es el criterio de exclusión más frecuente y complejo. La solvencia técnica demuestra la
experiencia previa ("Track Record").

3.2.1 Análisis de Similitud por CPV
La normativa indica que la experiencia se acredita mediante servicios o trabajos de "igual o
similar naturaleza". La presunción legal de similitud se basa en los tres primeros dígitos de
los códigos CPV.16
●​ Instrucción al Agente:
1.​ Extraer los códigos CPV del PCAP (ej. 72212000-4).
2.​ Truncar al tercer dígito (722).
3.​ Buscar en el repositorio de proyectos pasados ("Past Performance Database") de la
empresa aquellos con CPVs que comiencen por 722.
4.​ Sumar los importes de los proyectos válidos ejecutados en el periodo relevante (3
años para servicios/suministros, 5 para obras).
5.​ Comparar con el umbral exigido en el pliego (habitualmente el 70% del VAM).

3.2.2 Certificaciones y Habilitaciones
El agente debe escanear el texto en busca de patrones de normas ISO.
●​ Mapeo de Equivalencias: Si el pliego pide "ISO 9001", el agente debe saber que un
certificado de sistema de gestión de calidad equivalente también es válido. Sin embargo,
para certificaciones de seguridad críticas como el Esquema Nacional de Seguridad (ENS)
nivel Alto, la equivalencia es más estricta. El agente debe listar las credenciales faltantes
como "Bloqueantes".11

3.3 Prohibiciones de Contratar y Conflictos de Interés
Aunque más difícil de detectar automáticamente, el agente debe buscar menciones a
incompatibilidades específicas en el PCAP (ej. empresas que hayan participado en la
redacción de los pliegos). Además, debe verificar que la empresa no esté incursa en causas
de prohibición de contratar (ej. falta de planes de igualdad para empresas de >50
empleados), verificando la existencia de dicho plan en la documentación corporativa.17

4. Ingeniería Inversa del Motor de Evaluación (The
Scoring Engine)
Una vez superado el filtro de viabilidad, el agente debe diseccionar cómo se ganan los

puntos. La estrategia de licitación depende enteramente de la ponderación entre precio y
calidad técnica. El PCAP define una función de utilidad que el licitador intenta maximizar.

4.1 Criterios Evaluables mediante Fórmulas (Automáticos)
Estos criterios suelen representar entre el 51% y el 100% de la puntuación total. El agente
debe extraer las fórmulas matemáticas para permitir simulaciones de escenarios ("What-if
analysis").

4.1.1 Análisis de la Fórmula de Precio
No todas las fórmulas de precio son lineales. El comportamiento de la puntuación ante bajas
en el precio varía drásticamente.
●​ Fórmulas Lineales: Puntuación proporcional directa. Incentivan bajas moderadas.​
​
$$P_i = P_{max} \times \frac{O_{min}}{O_i}$$
●​ Fórmulas No Lineales (Curvas): Diseñadas para desincentivar bajas temerarias o para
saturar la puntuación rápidamente. El agente debe identificar si la fórmula tiene
exponentes o logaritmos que aplanan la curva de recompensa marginal.
○​ Insight de Segundo Orden: Si el agente detecta una fórmula donde la ganancia de
puntos por cada euro bajado decrece rápidamente (rendimientos decrecientes),
debe recomendar una estrategia de precio conservadora, ya que el riesgo de baja
temeraria no compensa los puntos marginales ganados.18

4.1.2 Detección y Cálculo de la Baja Temeraria (Abnormalmente Baja)
El miedo a la "Baja Temeraria" condiciona la oferta económica. El agente debe extraer los
parámetros que definen la presunción de anormalidad según el artículo 149 de la LCSP y los
pliegos.19
●​ Parámetros a Extraer:
○​ Umbral porcentual fijo (ej. "bajas superiores al 10%").
○​ Umbral dinámico (ej. "bajas superiores en 10 puntos porcentuales a la media
aritmética de las ofertas admitidas").
●​ Capacidad de Simulación: El agente debe advertir: "Basado en históricos de
licitaciones similares de este órgano, la baja media suele ser del 12%. El umbral de
temeridad está fijado en la media + 10 puntos. Una baja del 25% tiene un riesgo del 80%
de ser calificada como temeraria".

4.2 Criterios Sujetos a Juicio de Valor (Subjetivos)
Aquí reside la clave para la redacción de la oferta técnica. El agente debe desglosar la "caja
negra" de la valoración técnica en componentes accionables para la generación de texto.

4.2.1 Descomposición de Subcriterios

El PCAP suele asignar, por ejemplo, 40 puntos a la "Memoria Técnica". Pero el agente debe
profundizar más y encontrar el desglose fino:
●​
●​
●​
●​

Metodología: 15 puntos.
Plan de Calidad: 10 puntos.
Equipo de Trabajo: 5 puntos.
Mejoras: 10 puntos.​
Regla de Escritura: El agente debe asignar una extensión de texto (Word Count)
proporcional a los puntos. No tiene sentido escribir 20 páginas para un criterio de 5
puntos y 5 páginas para uno de 15. Esta "densidad de respuesta" debe ser gestionada
algorítmicamente.11

4.2.2 Separación de Sobres (Regla de Oro)
La IA debe aplicar una regla de seguridad estricta: Ningún dato evaluable por fórmula
(especialmente precios) debe aparecer en la documentación de juicio de valor. El
agente debe escanear la oferta técnica generada buscando patrones de moneda (€, euros, $)
y eliminar o ofuscar cualquier referencia económica. La violación de esta regla conlleva la
exclusión inmediata por vulneración del secreto de las ofertas ("Contaminación de Sobres").22

5. Estrategia de Construcción de la Oferta Técnica
(Technical Offer Shredding & Drafting)
Con la estructura de puntuación clara, el agente procede a la generación del contenido
técnico. Este proceso no es mera redacción creativa; es la respuesta sistemática a una lista
de requisitos ("Requirements Shredding").

5.1 Matriz de Cumplimiento y Trazabilidad (Compliance Matrix)
El agente debe recorrer el PPT párrafo a párrafo y extraer cada obligación
("shall/must/deberá").
●​ Estructura de Datos: Cada requisito extraído se convierte en una fila de la matriz de
cumplimiento.
●​ Vinculación: La IA debe vincular cada sección de la oferta generada con el ID del
requisito que satisface. Esto permite generar automáticamente una "Tabla de Referencias
Cruzadas" al final de la oferta, facilitando enormemente la labor del evaluador y
transmitiendo una imagen de rigor técnico.9

5.2 Identificación de "Win Themes" y Análisis de Sentimiento
Para diferenciar la oferta, el agente debe identificar los problemas latentes del cliente.
●​ Extracción de Dolores (Pains): Buscar palabras clave con connotación negativa en la
Memoria Justificativa: "retrasos", "obsoleto", "quejas", "ineficiente", "manual".
●​ Generación de Temas Ganadores (Win Themes): Para cada dolor, el agente debe

formular una solución y un beneficio ("Discriminator").
○​ Ejemplo: Dolor = "Sistemas obsoletos". Solución = "Migración a Cloud". Beneficio =
"Escalabilidad y Seguridad". Win Theme = "Modernización tecnológica sin riesgo
operativo".25
●​ Estilo y Tono: El agente debe adoptar un tono técnico, asertivo y orientado al servicio
público. Debe evitar el lenguaje comercial vacío ("somos líderes") y preferir la evidencia
basada en datos ("hemos gestionado 3 millones de expedientes similares").27

5.3 Estructuración de la Memoria Técnica
El agente debe proponer un índice (Table of Contents) que sea un espejo ("Mirroring") de los
criterios de valoración del PCAP. Esto reduce la carga cognitiva del evaluador.28
Esquema Estándar Optimizado para IA:
1.​ Resumen Ejecutivo: Síntesis de la solución y Win Themes (1-2 páginas).
2.​ Entendimiento del Proyecto: Demostración de que se ha leído el pliego (Contexto,
Objetivos).
3.​ Metodología de Ejecución (Core): Respuesta detallada al PPT. Diagramas de flujo
(descritos en texto para ser generados por herramientas como Mermaid).
4.​ Plan de Gestión y Equipo: Organigramas y perfiles.
5.​ Plan de Calidad y SLA: Métricas y herramientas de seguimiento.
6.​ Mejoras (Valor Añadido): Lista clara de lo que se ofrece por encima del mínimo,
cuantificado económicamente o en impacto.

5.4 Gestión de Mejoras (Opcionales vs. Obligatorias)
El agente debe distinguir semánticamente entre:
●​ Requisito Mínimo: "El sistema deberá tener..." (Condición de habilitación).
●​ Criterio de Valoración (Mejora): "Se valorará la inclusión de..." (Fuente de puntos).​
El agente debe sugerir mejoras específicas extraídas de una base de conocimiento de
"Mejores Prácticas" del sector, asegurándose de que estas mejoras sean puntuables
según el PCAP.30

6. Implementación Técnica para el Agente de IA: Datos
y Algoritmos
Para operacionalizar esta guía, se requiere una arquitectura de datos robusta. Se recomienda
extender el Open Contracting Data Standard (OCDS) para incluir campos específicos de la
fase de preparación de ofertas (pre-award analysis).

6.1 Esquema JSON para la Extracción de Pliegos
A continuación se define el esquema de datos que el agente debe poblar como resultado de

su análisis. Este JSON actúa como el "Estado del Mundo" para el agente.32

JSON

{​
"$schema": "http://standard.open-contracting.org/schema/1.5/release-schema.json",​
"tender_analysis_extension": {​
"risk_assessment": {​
"overall_risk_score": 0.85,​
"go_no_go_decision": "GO",​
"flags":​

},​
"scoring_model": {​
"total_points": 100,​
"objective_criteria":,​
"subjective_criteria":},​

{"name": "Herramientas", "weight": 10, "keywords":}​
]​
}​
]​
},​
"compliance_matrix":,​
"production_constraints": {​
"submission_deadline": "2025-12-15T14:00:00Z",​
"platform": "PLACSP",​
"format_requirements":,​
"envelope_structure": "3_ENVELOPES"​
}​
}​
}​

6.2 Estrategias de Prompt Engineering y NLP
Para lograr esta extracción con alta fidelidad, se deben emplear técnicas avanzadas de NLP:
1.​ Chunking Semántico: No cortar el texto arbitrariamente. Usar modelos de
segmentación que respeten la estructura de artículos y cláusulas legales.
2.​ Retrieval Augmented Generation (RAG): Indexar el pliego en una base de datos
vectorial. Cuando el agente genere la sección de "Seguridad", debe recuperar todos los
fragmentos del PPT relacionados con "seguridad", "datos", "ENS", "RGPD" para asegurar

que la respuesta cubre el 100% de los requisitos.35
3.​ Chain-of-Thought (CoT) para Fórmulas: Para extraer e interpretar fórmulas
matemáticas complejas, se debe pedir al modelo que explique paso a paso cómo
calcularía la puntuación para un precio hipotético antes de formalizar la fórmula en
código.9
4.​ Few-Shot Learning para Clasificación: Proveer al modelo ejemplos de cláusulas de
"Baja Temeraria" y su clasificación correspondiente para mejorar la precisión en la
detección de estos riesgos críticos.

6.3 Prevención de Alucinaciones en Datos Críticos
El agente debe tener prohibido "inferir" datos numéricos.
●​ Regla de Grounding: Cada dato extraído (fecha, importe, ratio) debe ir acompañado de
una referencia precisa a la fuente (Documento, Página, Párrafo). Si el dato no está
explícito, el agente debe marcarlo como "MISSING" y solicitar intervención humana, en
lugar de estimarlo.37

7. Gestión de Riesgos y Control de Calidad: El Rol de
Auditor del Agente
Más allá de la redacción, el agente debe actuar como un auditor de calidad ("Red Team") de
la propia oferta.

7.1 Riesgos Contractuales y Operativos
●​ Penalidades y Deducciones: El agente debe analizar el cuadro de penalidades del
PCAP. Si detecta penalidades automáticas por métricas SLA difíciles de cumplir (ej.
penalización por caída de servicio > 1 minuto), debe alertar al equipo técnico para que
sobredimensione la solución o evalúe el riesgo financiero.38
●​ Modificaciones del Contrato: Identificar si el pliego prevé "modificados" (hasta un 20%
adicional suele ser legal). Esto es información estratégica para la política de precios.

7.2 Riesgos de Exclusión Formal (Checklist Final)
El agente debe ejecutar una validación final antes del envío:
1.​ Validación de Sobres: Verificar que ningún archivo destinado al Sobre 2 (Técnico)
contiene números con formato de moneda que puedan interpretarse como oferta
económica.
2.​ Validación de Formatos: Comprobar extensiones de archivo (.pdf,.xml), firmas
electrónicas válidas y límites de tamaño (MB) impuestos por la plataforma de licitación.40
3.​ Garantías: Verificar que el resguardo de la garantía provisional (si aplica) está incluido
en el sobre correcto (habitualmente el Administrativo).

Tabla 2: Mapeo de Errores Comunes y Mitigación por IA
Tipo de Error

Descripción

Detección por
Agente IA

Acción de
Mitigación

Contaminación de
Sobres

Inclusión de
precios en la
memoria técnica.

Regex de moneda
(€, $) en
documentos del
Sobre 2.

Alerta bloqueante.
Sugerencia de
borrado/ofuscación
.

Defecto de
Solvencia

No alcanzar el
umbral de
facturación.

Comparación
aritmética
$VAN_{user}$ vs
$VAN_{doc}$.

Sugerencia de UTE
o solvencia externa.

Incumplimiento de
PPT

Omitir un requisito
mandatorio
("deberá").

Cruce de
Compliance Matrix
vs. Texto Generado.

Identificar gap y
generar párrafo de
cumplimiento.

Baja Temeraria
Involuntaria

Ofertar un precio
por debajo del
umbral de riesgo.

Simulación de
fórmula de
temeridad con
datos de mercado.

Alerta de riesgo de
exclusión/necesida
d de justificación.

Formato Inválido

Superar límite de
páginas.

Conteo de
tokens/páginas del
PDF generado.

Resumen
automático o
recorte de
secciones menos
ponderadas.

8. Conclusión
La implementación de un agente de IA para el análisis de pliegos y generación de ofertas
técnicas no es un proyecto de mera automatización documental, sino de ingeniería de
conocimiento. La capacidad del sistema para distinguir entre la rigidez normativa del PCAP y
la especificidad técnica del PPT, así como su habilidad para alinear la narrativa generada con
los criterios de puntuación subjetivos, determinará la competitividad de las ofertas
resultantes.

Esta guía establece los cimientos para un sistema que trasciende la función de "asistente de
redacción" para convertirse en un analista estratégico de licitaciones. Al estructurar la
información no estructurada, aplicar validaciones de solvencia rigurosas y blindar la oferta
contra errores formales, el agente de IA permite a los equipos humanos elevar su foco desde
la burocracia administrativa hacia la estrategia de valor y la innovación en el servicio público.
El futuro de la contratación pública es computable, y este protocolo es el manual de
instrucciones para esa realidad.

Obras citadas
1.​ Guía práctica para preparar tu oferta a una licitación pública - Gobierto, fecha de

acceso: diciembre 29, 2025,
https://www.gobierto.es/blog/guia-practica-para-preparar-tu-oferta-a-una-licita
cion-publica
2.​ Guía (Paso a Paso) para Evaluación de Ofertas de Obras, Bienes y Servicios y
Propuestas de Consultorías. - ONCAE, fecha de acceso: diciembre 29, 2025,
https://demo.oncae.gob.hn/archivos/category/51-proyectos?download=270:gui-a
-paso-a-paso-para-evaluacio-n-de-ofertas-bienes-obras-servicios-y-propuesta
s-de-consultori-as
3.​ Automated Tender Discovery using NLP (Natural Language Processing) - Cube
RM, fecha de acceso: diciembre 29, 2025,
https://www.cuberm.com/resources/automated-tender-discovery-using-nlp-natu
ral-language-processing/
4.​ Bid Smarter, Build Better: NLP's Impact on Project Progress, Risk and Safety
Tracking, fecha de acceso: diciembre 29, 2025,
https://medium.com/@datailm/bid-smarter-build-better-nlps-impact-on-risk-saf
ety-and-progress-tracking-68ed7cc166e0
5.​ Los pliegos de los contratos públicos - Gobierto, fecha de acceso: diciembre 29,
2025, https://www.gobierto.es/blog/los-pliegos-de-los-contratos-publicos
6.​ Contradicciones entre el PCAP y el PPT: principio de especialidad - Kalaman
Consulting, fecha de acceso: diciembre 29, 2025,
https://www.kalaman.es/contradicciones-entre-el-pcap-y-el-ppt-principio-de-es
pecialidad/
7.​ Diferencias ppt y pcap - Gobierto Contratación, fecha de acceso: diciembre 29,
2025,
https://contratos.gobierto.es/preguntas/bnmr9sni?utm_campaign=related_questi
ons_list&utm_medium=web&utm_source=questions
8.​ Cómo escribir un buen título de licitación y elegir los CPVs más adecuados Gobierto, fecha de acceso: diciembre 29, 2025,
https://www.gobierto.es/blog/como-escribir-un-buen-titulo-de-licitacion-y-elegir
-los-cpvs-mas-adecuados
9.​ 10 AI Prompts Every Government Contractor Should Know | CLEATUS, fecha de
acceso: diciembre 29, 2025,
https://www.cleat.ai/blog/10-ai-prompts-every-government-contractor-should-k
now

10.​Guía práctica para la redacción de pliegos técnicos y criterios de solvencia y

adjudicación - CARM.es, fecha de acceso: diciembre 29, 2025,
https://www.carm.es/web/descarga?ARCHIVO=Gu%C3%ADa.pdf&ALIAS=ARCH&
IDCONTENIDO=195930&IDTIPO=60&RASTRO=c79$m69797,69798
11.​ ¿Qué es una oferta técnica para licitaciones? - Europa Innova Group, fecha de
acceso: diciembre 29, 2025,
https://europainnovagroup.eu/que-es-una-oferta-tecnica-para-licitaciones/
12.​INFORME SOBRE LA VALORACIÓN DEL CRITERIO A (MEMORIA TÉCNICA) DE LAS
OFERTAS ADMITIDAS AL PROCESO DE LICITACIÓN PARA LA CONTRA, fecha de
acceso: diciembre 29, 2025,
https://contrataciondelestado.es/wps/wcm/connect/PLACE_es/Site/area/docAccC
mpnt?srv=cmpnt&cmpntname=GetDocumentsById&source=library&DocumentId
Param=7477fd57-66f6-4ab9-8d69-bfa5b4c9827d
13.​Diez errores frecuentes en la presentación de ofertas a licitaciones públicas Licigal, fecha de acceso: diciembre 29, 2025,
https://licigal.com/diez-errores-frecuentes-en-la-presentacion-de-ofertas-a-licit
aciones-publicas/
14.​PLIEGO MODELO DE CLÁUSULAS ADMINISTRATIVAS PARTICULARES PARA LA
CONTRATACION DE SUMINISTROS POR LOS PROCEDIMIENTOS ABIERTOS Plataforma de Contratación del Sector Público, fecha de acceso: diciembre 29,
2025,
https://contrataciondelestado.es/FileSystem/servlet/GetDocumentByIdServlet?Do
cumentIdParam=bohdZtG5G59%2BPahV42iMScP7VDTI4qHuUp20pr0ZgnzVV8m
wjkZOiaLt29qbC%2B4P0Mjj0%2BNTI2auFLEm/9q5hTZQFWLR/ZPMo5FxsK4OMU
n3GVhXrFFqN7yFncy7YfRK&cifrado=QUC1GjXXSiLkydRHJBmbpw%3D%3D
15.​Requisitos de solvencia - Gobierto, fecha de acceso: diciembre 29, 2025,
https://www.gobierto.es/blog/requisitos-de-solvencia
16.​Determinación de la solvencia técnica a través de la experiencia en trabajos o
servicios similares: aplicación de los tres primeros dígitos de la CPV |
Observatorio de Contratación Pública, fecha de acceso: diciembre 29, 2025,
https://www.obcp.es/monitor/determinacion-de-la-solvencia-tecnica-traves-de-l
a-experiencia-en-trabajos-o-servicios
17.​Las causas de exclusión facultativas en contratación pública - Jaime Pintos, fecha
de acceso: diciembre 29, 2025,
https://www.jaimepintos.com/las-causas-de-exclusion-facultativas-en-contrataci
on-publica-facultativas-para-quien/
18.​Límite a las fórmulas de valoración del criterio precio - Asocex, fecha de acceso:
diciembre 29, 2025,
https://asocex.es/limite-a-las-formulas-de-valoracion-del-criterio-precio/
19.​BAJAS TEMERARIAS CALCULO, fecha de acceso: diciembre 29, 2025,
https://contrataciondelestado.es/FileSystem/servlet/GetDocumentByIdServlet?Do
cumentIdParam=rgZHE%2B3Mg7HsilkN9qGTV/BmHQjewCFP/RW3jG%2BEqwsBq
FKqPRvb1d8ImLXtGcpiHQbgHMffxrnSmZXeAHSeDKz6O%2BWzto2NsJLpdGtL%
2Bfk%3D&cifrado=QUC1GjXXSiLkydRHJBmbpw%3D%3D
20.​Ofertas anormalmente bajas - esPublico, fecha de acceso: diciembre 29, 2025,

https://www.espublico.com/files/acceso/catalogos/CP-GUI-00001250.pdf
21.​Calcular una baja temeraria en licitaciones públicas: Guía completa, fecha de
acceso: diciembre 29, 2025,
https://lifesectorpublico.com/calcular-una-baja-temeraria-en-licitaciones-publica
s-guia-completa/
22.​Los criterios sujetos a juicio de valor. El caballo de Troya de la ..., fecha de acceso:
diciembre 29, 2025,
https://revistasonline.inap.es/index.php/REALA/article/download/11372/12946?inlin
e=1
23.​Exclusión licitador irregularidad formal - Litinet, fecha de acceso: diciembre 29,
2025,
https://litinet.com/contratacion-publica/exclusion-licitador-irregularidad-formal/
24.​How to Write a Tender with AI | Responsive, fecha de acceso: diciembre 29, 2025,
https://www.responsive.io/blog/how-to-write-a-tender-with-ai
25.​How to Develop & Use Win Themes in Your Proposal Response, fecha de acceso:
diciembre 29, 2025,
https://www.lmcproposals.com/blog/how-to-use-develo-win-themes
26.​Proposal Win Themes: Everything You Need To Know - Help Everybody Everyday,
fecha de acceso: diciembre 29, 2025,
https://www.helpeverybodyeveryday.com/marketing-101/4159-proposal-win-the
mes
27.​How to Create Winning Proposal Themes - 24 Hour Company, fecha de acceso:
diciembre 29, 2025,
https://24hrco.com/how-to-create-winning-proposal-themes/
28.​¿Cómo preparar una buena memoria técnica? - Licitate.es, fecha de acceso:
diciembre 29, 2025,
https://www.licitate.es/como-preparar-una-memoria-tecnica-licitacion/
29.​Memorias técnicas en licitaciones: guía completa para empresas y profesionales,
fecha de acceso: diciembre 29, 2025,
https://europainnovagroup.eu/memorias-tecnicas-licitaciones-guia/
30.​Criterios de juicio de valor en licitaciones públicas: ejemplos prácticos, fecha de
acceso: diciembre 29, 2025,
https://lifesectorpublico.com/criterios-juicio-de-valor-ejemplos-licitaciones/
31.​45. Directo: Examen A1 (Bajas temerarias y art. 242 LCSP) - YouTube, fecha de
acceso: diciembre 29, 2025, https://www.youtube.com/watch?v=q4YE6Kc5s2w
32.​record schema reference - Open Contracting Data Standard, fecha de acceso:
diciembre 29, 2025, https://standard.open-contracting.org/latest/en/schema/
33.​ocds-standard/standard/schema/release-schema.json at master ·
avian2/ocds-standard - GitHub, fecha de acceso: diciembre 29, 2025,
https://github.com/avian2/ocds-standard/blob/master/standard/schema/release-s
chema.json
34.​A Media Type for Describing JSON Documents - JSON Schema, fecha de acceso:
diciembre 29, 2025, https://json-schema.org/draft/2020-12/json-schema-core
35.​How to Extract Data from Tender Documents in Minutes with AI - Nexizo, fecha de
acceso: diciembre 29, 2025,

https://nexizo.ai/blogs/how-to-extract-data-from-tender-documents-in-minutes
-with-ai
36.​Workflow for Extracting Structured Data from Tender Documents to ..., fecha de
acceso: diciembre 29, 2025,
https://hackernoon.com/workflow-for-extracting-structured-data-from-tenderdocuments-to-build-supplier-risk-profiles
37.​AI in Bid Management | Transforming Tender Automation - Minaions, fecha de
acceso: diciembre 29, 2025,
https://minaions.com/blog/ai-in-bid-management-future
38.​El pliego de cláusulas administrativas particulares. - Jaime Pintos, fecha de
acceso: diciembre 29, 2025,
https://www.jaimepintos.com/el-pliego-de-clausulas-administrativas-particulares
/
39.​PLIEGO DE CONDICIONES PARA LA CONTRATACIÓN DEL SERVICIO 24x7 DE
SEGURIDAD GESTIONADA (SOC), OPERACIÓN, fecha de acceso: diciembre 29,
2025,
https://contrataciondelestado.es/wps/wcm/connect/PLACE_es/Site/area/docAccC
mpnt?srv=cmpnt&cmpntname=GetDocumentsById&source=library&DocumentId
Param=b395287d-49fe-4b41-89d8-b7009c1079c2
40.​errores técnicos más frecuentes en la presentación de ofertas - Hacienda
Navarra, fecha de acceso: diciembre 29, 2025,
https://hacienda.navarra.es/sicpportal/mtoGeneraDocumento.aspx?DOA=210910
12443278CA3113&DOL=1
41.​AYUNTAMIENTO DE TORRENT - Licitación electrónica en la Plataforma de
Contratación del Sector Público, fecha de acceso: diciembre 29, 2025,
https://torrent.es/wp-content/uploads/2022/08/Manual-Licitacion-electronica.pdf

