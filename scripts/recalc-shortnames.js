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
  '祥承': '祥承', '卓望': '卓望', '云迹科技': '云迹', '51World': '51World',
  '西门子': '西门子', '方里': '方里', '联合影像': '联合影像', '曼伦': '曼伦',
  'PPIO': 'PPIO', '元梦灵境': '元梦灵境', '我思科技': '我思', '北京破圈': '破圈',
  '海归爸爸': '海归爸爸', '香港中企': '香港中企',
  '美团': '美团', '京东': '京东', '拼多多': '拼多多', '小米': '小米', '网易': '网易',
  '百度': '百度', '华为': '华为', '腾讯': '腾讯', '蓝月亮': '蓝月亮', '五粮液': '五粮液',
  '徕芬': '徕芬',
};

const suffixes = [
  // 长的先匹配
  '集团股份有限公司', '集团有限责任公司', '控股股份有限公司', '控股有限责任公司',
  '集团控股有限公司', '科技股份有限公司', '技术股份有限公司', '信息科技有限公司',
  '网络科技有限公司', '软件科技有限公司', '数据科技有限公司', '智能科技有限公司',
  '生物科技有限公司', '电子科技有限公司', '新材料科技有限公司',
  '股份有限公司', '有限责任公司', '集团有限公司', '集团公司', '集团有限',
  '有限公司', '有限责任', '股份公司',
  '进出口有限公司', '国际贸易有限公司', '电子商务有限公司',
  '科技', '技术', '信息', '网络', '软件', '数据', '智能', '生物', '电子', '新材料',
  '贸易', '商贸', '实业', '工业', '控股', '集团',
  '分公司', '公司', '株式会社', '合伙',
];

const prefixes = [
  '中国', '上海市', '北京市', '广州市', '深圳市', '杭州市', '南京市', '成都市',
  '天津市', '武汉市', '重庆市', '西安市', '长沙市', '郑州市', '青岛市', '宁波市',
  '浙江省', '江苏省', '广东省', '山东省', '四川省', '河南省', '湖北省', '湖南省',
  '福建省', '安徽省', '河北省', '江西省', '陕西省', '辽宁省', '云南省', '贵州省',
  '甘肃省', '广西省',
  '上海', '北京', '广州', '深圳', '杭州', '南京', '成都', '天津', '武汉', '重庆',
];

function shortName(name) {
  if (!name) return '';
  let s = name.trim();
  if (!s) return '';

  // 括号开头的（如"(待确认)"、"(A股上市...)"）是描述而非公司名，返回空
  if (s.startsWith('（') || s.startsWith('(')) return '';

  // 优先精确匹配
  for (const [k, v] of Object.entries(known)) {
    if (s.includes(k)) return v;
  }

  // 去掉所有括号内容（可能有多组）
  s = s.replace(/[（(][^）)]*[）)]/g, '').trim();

  // 去掉「隶属于xxx」等注释
  s = s.replace(/隶属于.*$/, '').trim();

  // 反复去后缀（最多5轮）
  for (let round = 0; round < 5; round++) {
    let changed = false;
    for (const suf of suffixes) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length).trim();
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  // 如果结果>4字且以地域开头，去掉地域前缀
  if (s.length > 5) {
    for (const p of prefixes) {
      if (s.startsWith(p)) {
        const stripped = s.slice(p.length).trim();
        if (stripped.length >= 2) { s = stripped; break; }
      }
    }
  }

  // 如果最终结果太长(>6字)，但已知知名品牌不在里面，取前4字
  if (s.length > 6) s = s.slice(0, 4);

  return s || '';
}

// 重新计算所有有公司名的线索简称（覆盖之前自动生成的，保留空公司名不动）
const leads = db.prepare("SELECT id, company_name, company_short_name FROM leads WHERE company_name != ''").all();
const stmt = db.prepare('UPDATE leads SET company_short_name = ? WHERE id = ?');
let updated = 0;
const trx = db.transaction(() => {
  for (const l of leads) {
    const sn = shortName(l.company_name);
    if (sn !== (l.company_short_name || '')) {
      stmt.run(sn, l.id);
      updated++;
    }
  }
});
trx();
console.log('重新计算简称:', leads.length, '条线索, 更新了', updated, '条\n');

// 效果对比
console.log('=== 简称效果示例 ===');
const samples = db.prepare("SELECT company_name, company_short_name FROM leads WHERE company_short_name != '' AND company_name != '' ORDER BY RANDOM() LIMIT 25").all();
samples.forEach(s => console.log(`  ${String(s.company_short_name).padEnd(10)} ← ${s.company_name}`));

// 统计
const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
const withName = db.prepare("SELECT COUNT(*) as c FROM leads WHERE company_name != '' AND company_name IS NOT NULL").get().c;
const withShort = db.prepare("SELECT COUNT(*) as c FROM leads WHERE company_short_name != ''").get().c;
const empty = total - withShort;
console.log(`\n统计: 总${total}条 | 有公司名${withName}条 | 有简称${withShort}条 | 空${empty}条(无公司名/待确认)`);

// 检查质量：简称>4字的有多少（可能还需优化）
const longShorts = db.prepare("SELECT company_name, company_short_name FROM leads WHERE length(company_short_name) > 5 AND company_short_name != '' LIMIT 10").all();
if (longShorts.length) {
  console.log('\n仍然偏长的简称(>5字):');
  longShorts.forEach(s => console.log(`  ${s.company_short_name} ← ${s.company_name}`));
}
