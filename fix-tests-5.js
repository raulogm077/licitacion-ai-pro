import fs from 'fs';

let content = fs.readFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', 'utf8');
content = content.replace('});\n    });\n});', '});\n});');
fs.writeFileSync('src/features/dashboard/__tests__/DashboardInteraction.test.tsx', content);
