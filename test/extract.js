const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');

function readIndexLines() {
  const bytes = fs.readFileSync(INDEX_PATH);
  const text = bytes.toString('utf8');
  return text.split('\n');
}

function getTemplateLineIndex(lines) {
  const markerIdx = lines.findIndex((l) => l.trim() === '<script type="__bundler/template">');
  if (markerIdx === -1) throw new Error('__bundler/template script tag not found');
  // The JSON string payload is the next non-empty line.
  for (let i = markerIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') return i;
  }
  throw new Error('template payload line not found');
}

function getTemplateHtml() {
  const lines = readIndexLines();
  const idx = getTemplateLineIndex(lines);
  return JSON.parse(lines[idx]);
}

function getAppScript(templateHtml) {
  const html = templateHtml || getTemplateHtml();
  const startTag = '<script type="text/x-dc" data-dc-script=""';
  const si = html.indexOf(startTag);
  if (si === -1) throw new Error('text/x-dc script tag not found in template');
  const scriptStart = html.indexOf('>', si) + 1;
  const scriptEnd = html.indexOf('</script>', scriptStart);
  if (scriptEnd === -1) throw new Error('closing </script> not found for text/x-dc block');
  return html.slice(scriptStart, scriptEnd);
}

module.exports = { INDEX_PATH, readIndexLines, getTemplateLineIndex, getTemplateHtml, getAppScript };
