const fs = require('fs');
try {
  const content = fs.readFileSync('C:\\Users\\nab221\\CODE\\budget-app\\src\\ui\\targets.js', 'utf8');
  new Function(content);
  console.log('Syntax OK');
} catch (e) {
  console.error(e);
}
