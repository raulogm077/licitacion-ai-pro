import fs from 'fs';

let content = fs.readFileSync('src/features/upload/components/AnalysisWizard.tsx', 'utf8');

// fix defaultMode error (just remove it, AuthModal might not accept it)
content = content.replace(/defaultMode="login"\n/g, '');

// Fix impossible comparison (we conditionally rendered this block for state === idle | ready | error, so analyzing will never be true here)
content = content.replace(/disabled=\{state === 'analyzing'\}/g, 'disabled={false}');

fs.writeFileSync('src/features/upload/components/AnalysisWizard.tsx', content);
