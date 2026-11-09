// Prints one line per sensor from Libre Hardware Monitor: path | value | SensorId
//
// Usage:  node scripts/list-sensors.mjs [url]
// Example: node scripts/list-sensors.mjs > sensors.txt
//
// Needs Node 18+ (built-in fetch) and LHM's Remote Web Server running.
// The first path segments include your computer name. Remove it before
// sharing the output publicly.

const url = process.argv[2] ?? 'http://localhost:8085/data.json';

let json;
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  json = await response.json();
} catch (err) {
  console.error(`Could not read ${url}: ${err.message}`);
  console.error('Is Libre Hardware Monitor running with the Remote Web Server enabled?');
  process.exit(1);
}

function walk(node, path = '') {
  const here = path ? `${path} / ${node.Text}` : node.Text;
  if (node.Value) console.log(`${here} | ${node.Value} | ${node.SensorId ?? ''}`);
  for (const child of node.Children ?? []) walk(child, here);
}

walk(json);
