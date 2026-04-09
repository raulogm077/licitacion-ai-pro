const fs = require('fs');
const content = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
`;
fs.writeFileSync('.github/dependabot.yml', content);
