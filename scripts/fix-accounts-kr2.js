import Database from 'better-sqlite3';
const db = new Database('./data/mkt-crm.db');

// 按KR2报告9/23终版口径修正41家客户tier和customer_stage
// 已签约3家 | 投标1家 | B类重点7家 | POC3家(含在B/签约里) | C类9家 | D类14家 | 战败5家
const fixes = [
  // 已签约/交付中
  ['卓正医疗', 'S', '交付中', 700],
  ['南孚电池', 'A', '交付中', 20],
  ['HKIC', 'B', 'POC中', 5],
  // 投标中
  ['宇通客车', 'A', '投标中', 200],
  // B类重点推进7家
  ['吉利汽车', 'B', '重点推进', 390],
  ['三一重工', 'B', '重点推进', 0],
  ['极光湾科技', 'B', '重点推进', 0],
  ['墨迹天气', 'B', '重点推进', 100],
  ['金智教育', 'B', '重点推进', 0],
  ['致远互联', 'B', '重点推进', 0],
  ['普联香港', 'B', '重点推进', 600],
  // C类跟进9家
  ['中信资本', 'C', '跟进中', 0],
  ['混沌学园', 'C', '跟进中', 0],
  ['健主任', 'C', '已付费', 10],
  ['曼伦', 'C', '跟进中', 0],
  ['PPIO', 'C', '跟进中', 0],
  ['联合影像', 'C', '跟进中', 0],
  ['中金公司', 'C', '跟进中', 0],
  ['华泰研究所', 'C', '跟进中', 0],
  ['鹏扬基金', 'C', '跟进中', 0],
  // D类观察14家
  ['刀法咨询', 'D', '观察中', 0],
  ['方里', 'D', '观察中', 0],
  ['卓望', 'D', '观察中', 0],
  ['祥承', 'D', '观察中', 0],
  ['欢瑞世纪', 'D', '观察中', 0],
  ['青钜科技', 'D', '观察中', 0],
  ['卓越教育', 'D', '观察中', 0],
  ['新世纪医疗集团', 'D', '观察中', 0],
  ['我思科技', 'D', '观察中', 0],
  ['元梦灵境', 'D', '观察中', 0],
  ['云迹科技', 'D', '观察中', 0],
  ['北京破圈', 'D', '观察中', 0],
  ['香港中企', 'D', '观察中', 0],
  ['海归爸爸', 'D', '观察中', 0],
  ['51World', 'D', '观察中', 0],
  ['西门子', 'D', '观察中', 0],
  // 战败/放弃5家（Hysan希慎算战败）
  ['Hysan希慎', 'D', '战败', 0],
  ['得到', 'D', '放弃', 0],
  ['流利说', 'D', '放弃', 0],
];

const upd = db.prepare('UPDATE accounts SET tier = ?, customer_stage = ?, deal_amount = ? WHERE company_name = ?');
let updated = 0;
const trx = db.transaction(() => {
  for (const [name, tier, stage, amount] of fixes) {
    const r = upd.run(tier, stage, amount, name);
    if (r.changes > 0) updated++;
  }
});
trx();
console.log('更新客户:', updated, '家\n');

// 删除两个测试/无效条目
db.prepare("DELETE FROM accounts WHERE company_name IN ('吴师/黄江华','Leo~JXQ金总')").run();

// 验证
const stages = db.prepare('SELECT customer_stage, tier, COUNT(*) as c, SUM(deal_amount) as amt FROM accounts GROUP BY customer_stage, tier ORDER BY c DESC').all();
console.log('修正后分布:');
stages.forEach(s => console.log(`  ${s.tier||'-'}级 ${s.customer_stage||'(空)'}: ${s.c}家 / ${s.amt||0}万`));

const total = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
const signedAmt = db.prepare("SELECT COALESCE(SUM(deal_amount),0) as t FROM accounts WHERE customer_stage IN ('已签约','交付中')").get().t;
const pipeAmt = db.prepare("SELECT COALESCE(SUM(deal_amount),0) as t FROM accounts WHERE customer_stage NOT IN ('战败','放弃','观察中','')").get().t;
console.log(`\n总计: ${total}家 | 签约金额: ${signedAmt}万 | 管线总额: ${pipeAmt}万`);
