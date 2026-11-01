const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
const data = JSON.parse(fs.readFileSync(path.join(pub, 'data/analysis.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(pub, 'data/geometry.geojson'), 'utf8'));
assert.equal(data.rows.length, 426);
assert.equal(geo.features.length, 426);
assert.equal(new Set(data.rows.map(r => r.code)).size, 426);
assert.deepEqual(new Set(data.rows.map(r => r.code)), new Set(geo.features.map(f => f.properties.code)));
const sum = a => a.reduce((s, v) => s + v, 0);
const close = (a,b) => assert(Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const cityHours = Array.from({length:24}, (_,h) => sum(data.rows.map(r=>r.hourly[h])));
const cityShare = sum(cityHours.slice(9,18))/sum(cityHours);
close(cityShare, data.city.day_share);
for (const r of data.rows) {
  assert.equal(r.hourly.length,24);
  assert(r.hourly.every(n=>Number.isFinite(n)&&n>=0));
  assert(r.area_km2>0);
  const day = sum(r.hourly.slice(9,18))/9;
  const night = sum(r.hourly.slice(0,6))/6;
  close(r.day_population,day);
  close(r.day_density,day/r.area_km2);
  close(r.day_lq,(day*9/sum(r.hourly))/cityShare);
  close(r.day_night_ratio,day/night);
}
const audit = JSON.parse(fs.readFileSync(path.join(pub,'data/validation.json'),'utf8'));
for (const [file, expected] of Object.entries(audit.input_sha256)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'data/assignment3',file))).digest('hex');
  assert.equal(actual,expected,`Input checksum mismatch: ${file}`);
}
const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)){
  if(!/^https?:|^data:/.test(match[1]))assert(fs.existsSync(path.resolve(pub,match[1])),`Missing ${match[1]}`);
}
assert(!html.includes('seoul-jeonse-analysis'));
const app=fs.readFileSync(path.join(pub,'app.js'),'utf8');
for(const match of app.matchAll(/\$\('([^']+)'\)/g))assert(html.includes(`id="${match[1]}"`),`Missing UI target ${match[1]}`);
assert.equal(fs.readFileSync(path.join(pub,'data/indicators.csv'),'utf8').trim().split(/\r?\n/).length,427);
console.log('Verified 426 districts, geometry joins, density/LQ/ratio calculations, input checksums, CSV and page assets.');
