import Database from 'better-sqlite3';
const db = new Database('./data/mkt-crm.db');

const known = {
  '中国平安保险': '中国平安', '平安保险': '平安', '字节跳动': '字节', '阿里巴巴': '阿里',
  '三一重工': '三一重工', '吉利汽车': '吉利', '宇通客车': '宇通', '南孚电池': '南孚',
  '卓正医疗': '卓正', '极光湾科技': '极光湾', '墨迹天气': '墨迹天气', '金智教育': '金智教育',
  '致远互联': '致远', '普联香港': '普联', '嘉顿食品': '嘉顿', '莲藕健康': '莲藕健康',
  '维他奶': '维他奶', '分众传媒': '分众', '玛氏箭牌': '玛氏',
  'HKIC': 'HKIC', '混沌学园': '混沌', '中信资本': '中信资本', '中金公司': '中金',
  '华泰研究所': '华泰', '鹏扬基金': '鹏扬', '健主任': '健主任', '刀法咨询': '刀法',
  'Hysan': '希慎', '希慎': '希慎', '流利说': '流利说', '得到': '得到',
  '青钜科技': '青钜', '欢瑞世纪': '欢瑞', '卓越教育': '卓越', '新世纪医疗': '新世纪医疗',
  '祥承': '祥承', '卓望': '卓望', '云迹': '云迹', '51World': '51World',
  '西门子': '西门子', '方里': '方里', '联合影像': '联合影像', '曼伦': '曼伦',
  'PPIO': 'PPIO', '元梦灵境': '元梦灵境', '我思科技': '我思', '北京破圈': '破圈',
  '海归爸爸': '海归爸爸', '香港中企': '香港中企',
};

function shortName(name) {
  if (!name) return '';
  const orig = name.trim();

  // 优先精确匹配
  for (const [k, v] of Object.entries(known)) {
    if (orig.includes(k)) return v;
  }

  let s = orig;
  // 去掉括号内容
  s = s.replace(/[（(][^）)]*[）)]/g, '').trim();
  // 去掉常见公司后缀（从长到短）
  const suffixes = [
    '集团股份有限公司', '集团有限责任公司', '股份有限公司', '有限责任公司', '集团有限公司',
    '集团公司', '有限公司', '有限责任', '股份公司',
    '集团', '控股', '科技', '技术', '信息', '网络', '软件', '数据', '智能',
    '分公司', '公司', '株式会社',
  ];
  for (const suf of suffixes) {
    if (s.endsWith(suf)) { s = s.slice(0, -suf.length).trim(); break; }
  }

  // 去地域前缀（过长时）
  if (s.length > 6) {
    const prefixes = ['中国', '上海市', '北京市', '广州市', '深圳市', '杭州市', '浙江省', '江苏省', '广东省', '上海', '北京', '广州', '深圳', '杭州'];
    for (const p of prefixes) {
      if (s.startsWith(p)) { s = s.slice(p.length).trim(); break; }
    }
  }

  // 如果还是太长，取前4字
  if (s.length > 6) s = s.slice(0, 4);

  return s || orig.slice(0, 4);
}

const leads = db.prepare("SELECT id, company_name, company_short_name FROM leads WHERE company_short_name = '' OR company_short_name IS NULL").all();
console.log('需要填充:', leads.length, '条');

const stmt = db.prepare('UPDATE leads SET company_short_name = ? WHERE id = ?');
let updated = 0;
const trx = db.transaction(() => {
  for (const l of leads) {
    const sn = shortName(l.company_name);
    if (sn) { stmt.run(sn, l.id); updated++; }
  }
});
trx();
console.log('已更新:', updated, '条\n');

// 示例
const samples = db.prepare('SELECT company_name, company_short_name FROM leads ORDER BY RANDOM() LIMIT 20').all();
samples.forEach(s => console.log(`  ${s.company_short_name.padEnd(10)} ← ${s.company_name}`));
