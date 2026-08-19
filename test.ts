import MiniSearch from 'minisearch';
import fs from 'node:fs/promises';

const json = await fs.readFile('public/search/index.json', 'utf-8');
const ms = MiniSearch.loadJSON(json, {
    fields: ['title', 'subtitle', 'tokens'],
    storeFields: ['type', 'slug', 'title', 'subtitle', 'year'],
});

// Search for known building name words
console.log('--- hall ---');
console.log(ms.search('hall').slice(0, 5));

// And via searchAll which can be more permissive
console.log('--- prefix:hall ---');
console.log(ms.search('hall', { prefix: true }).slice(0, 5));

// Try a typo to test fuzzy
console.log('--- haal ---');
console.log(ms.search('haal').slice(0, 5));