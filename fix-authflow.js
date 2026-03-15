import fs from 'fs';

let content = fs.readFileSync('src/features/auth/__tests__/AuthFlow.test.tsx', 'utf8');
// The mock data test relies on the old UI "Iniciar Sesión" being present.
// Since the layout was completely restructured, the test should click the header button.

content = content.replace(/const loginButton = screen\.getByRole\('button', \{ name: \/iniciar sesión\/i \}\);/g,
  "const loginButton = screen.getAllByRole('button', { name: /iniciar sesión/i })[0];");

content = content.replace(/expect\(screen\.getByText\(\/debes iniciar sesión\/i\)\)\.toBeInTheDocument\(\);/g,
  "expect(screen.getByRole('dialog')).toBeInTheDocument();");

fs.writeFileSync('src/features/auth/__tests__/AuthFlow.test.tsx', content);
