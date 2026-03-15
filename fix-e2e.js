import fs from 'fs';
let content = fs.readFileSync('e2e/app.spec.ts', 'utf8');

// Update to look for new text inside the dropzone
content = content.replace(/Sube el documento/g, "Arrastra el pliego de licitación");
fs.writeFileSync('e2e/app.spec.ts', content);

let content2 = fs.readFileSync('e2e/collaboration.spec.ts', 'utf8');
content2 = content2.replace(/Analizar con IA/g, "Analizar Pliego");
content2 = content2.replace(/Ver documento original/g, "Ver Original");
content2 = content2.replace(/Sube el documento/g, "Arrastra el pliego de licitación");
fs.writeFileSync('e2e/collaboration.spec.ts', content2);
