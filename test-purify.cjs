const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

const raw = '<tr><td>Test</td></tr>';
const sanitized = purify.sanitize(raw, {
    ALLOWED_TAGS: ['tr', 'td']
});

console.log('Raw:', raw);
console.log('Sanitized:', sanitized);
