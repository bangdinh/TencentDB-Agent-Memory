const fs = require('fs');
const path = require('path');

const localAppData = process.env.LOCALAPPDATA;
const appData = process.env.APPDATA;

const targets = [
  path.join(localAppData, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  path.join(appData, 'Claude', 'claude_desktop_config.json')
];

for (const p of targets) {
  if (fs.existsSync(p)) {
    let raw = fs.readFileSync(p, 'utf8');
    // Strip BOM
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    try {
      const data = JSON.parse(raw);
      const cleanJson = JSON.stringify(data, null, 2);
      fs.writeFileSync(p, cleanJson, { encoding: 'utf8' });
      console.log('Successfully cleaned BOM and formatted valid JSON:', p);
    } catch (err) {
      console.error('JSON parse error in:', p, err.message);
    }
  }
}
