// 最小 RFC4180 CSV 解析（支持引号包裹、引号内逗号/换行、BOM）
export function parseCsv(text) {
  const s = String(text).replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (!nonEmpty.length) return [];
  const hdr = nonEmpty[0].map(h => h.trim());
  return nonEmpty.slice(1).map(cells => {
    const o = {};
    hdr.forEach((h, i) => { o[h] = cells[i] === undefined ? '' : String(cells[i]).trim(); });
    return o;
  });
}
