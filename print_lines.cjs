const fs = require('fs');
const content = fs.readFileSync('src/db/repository.js', 'utf8');
const lines = content.split('\n');
for (let i = 240; i <= 265; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
