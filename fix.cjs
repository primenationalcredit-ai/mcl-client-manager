const fs = require('fs');
var buf = fs.readFileSync('index.html');
// The file has double-encoded UTF-8. Read as latin1 to undo one layer.
var text = buf.toString('latin1');
// Now write as UTF-8
fs.writeFileSync('index.html', text, 'utf8');
var check = fs.readFileSync('index.html', 'utf8');
console.log(check.includes('MCL Client Manager') ? 'OK' : 'BAD');
