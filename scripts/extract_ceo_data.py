#!/usr/bin/env python3
"""
CEO获客报告数据抽取管线（参照《CEO获客取数逻辑》· 章鱼烧 2026-09-23）
数据源（A/B/C/D）原始表格 → src/data/ceoReport.json

运行前提：knowledge/kr2-data-foundation/ 下有底稿文件（KR2取数逻辑与底层数据.zip 解压）
用法：python3 scripts/extract_ceo_data.py
"""
import zipfile, datetime, json, glob, re, sys, os

BASE = os.path.join(os.path.dirname(__file__), '..', '..', 'knowledge', 'kr2-data-foundation')
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'ceoReport.json')
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def read_xlsx(path):
    """openpyxl兼容读取（SDR周报styles损坏，走XML直读）"""
    import openpyxl
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        return {ws.title: [list(r) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets}
    except Exception:
        return read_xlsx_xml(path)

def read_xlsx_xml(path):
    z = zipfile.ZipFile(path)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            ss.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rid2tgt = {r.get('Id'): r.get('Target') for r in rels}
    sheets = {}
    for s in wb.find(NS + 'sheets'):
        rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        tgt = rid2tgt[rid]
        if not tgt.startswith('xl/'): tgt = 'xl/' + tgt.lstrip('/')
        root = ET.fromstring(z.read(tgt))
        rows = []
        for row in root.iter(NS + 'row'):
            d = {}
            for c in row:
                col = ''.join(ch for ch in (c.get('r') or '') if ch.isalpha())
                v = c.find(NS + 'v')
                if v is None:
                    isEl = c.find(NS + 'is')
                    d[col] = ''.join(x.text or '' for x in isEl.iter(NS + 't')) if isEl is not None else ''
                elif c.get('t') == 's': d[col] = ss[int(v.text)]
                else: d[col] = v.text
            rows.append(d)
        # dict行 → 数组行（按最大列数对齐）
        width = 0
        for r in rows: width = max(width, *([len(d) for d in [dict.fromkeys(range(0, 0))]] or [0]), max([ord(c[-1]) - 64 if len(c) == 1 else 0 for c in r] + [0]) if r else 0)
        maxcol = 0
        for r in rows:
            for c in r: maxcol = max(maxcol, _colnum(c))
        arr = []
        for r in rows:
            arr.append([r.get(_colname(i), '') for i in range(1, maxcol + 1)])
        sheets[s.get('name')] = arr
    return sheets

def _colnum(c):
    n = 0
    for ch in c: n = n * 26 + (ord(ch) - 64)
    return n

def _colname(i):
    s = ''
    while i: i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s

from xml.etree import ElementTree as ET

def xldate(s):
    try: return (datetime.date(1899, 12, 30) + datetime.timedelta(days=float(s))).isoformat()
    except Exception: return ''

# ===== A: 微伴 7 个活码渠道分表 → 加微明细（昵称、渠道、添加时间）=====
EVENT_MAP = {  # 渠道名 → 标准活动名（与 ceo_events 表一致）
    '《晚点》头条-octo体验': '《晚点》头条',
    '全球AI生态与创新峰会20260808': 'AI生态峰会',
    '国有企业领导人员经营管理培训班（EMP）': '国企EMP',
    'Octo产品发布（明略公众号）': 'Octo产品发布',
    'CAIO峰会': 'CAIO峰会',
    '中欧商学院0825': '中欧商学院',
    '外滩大会': '外滩大会',
}
contacts = []
seen = set()
for f in sorted(glob.glob(os.path.join(BASE, '微伴-客户列表数据导出-*.xlsx'))):
    sheets = read_xlsx(f)
    rows = list(sheets.values())[0]
    hdr_i = next(i for i, r in enumerate(rows) if r and str(r[0] or '').strip() == '全部客户')
    for r in rows[hdr_i + 1:]:
        if not (r and any(c is not None and str(c).strip() for c in r)): continue
        nick = str(r[0] or '').strip()
        chan = str(r[8] or '').replace('通过渠道码', '').replace('添加', '').strip()
        key = (nick, chan)
        if key in seen: continue
        seen.add(key)
        contacts.append({'nick': nick, 'chan': chan, 'addtime': str(r[6] or '')[:16]})
nick2chan = {c['nick']: c['chan'] for c in contacts}
adds_per_event = {}
for c in contacts: adds_per_event[EVENT_MAP.get(c['chan'], c['chan'])] = adds_per_event.get(EVENT_MAP.get(c['chan'], c['chan']), 0) + 1

# ===== B: OCTO内测申请表 → 申请/开通/归属/自报来源 =====
apps = []
rows = read_xlsx(os.path.join(BASE, 'Octo内测组织申请表0918.xlsx'))
arows = list(rows.values())[0]
hdr = [str(c or '') for c in arows[0]]
def hcol(sub):
    for i, h in enumerate(hdr):
        if sub in h: return i
    return None
ci = {'filler': hcol('填写人'), 'time': hcol('填写时间'), 'name': hcol('姓名'), 'company': hcol('公司名称'),
      'audit': hcol('审核结果'), 'know': hcol('从哪里知道')}
for r in arows[1:]:
    if not any(c is not None and str(c).strip() for c in r): continue
    filler = str(r[ci['filler']] or '').strip()
    nick = filler.replace('@微信', '').strip()
    apps.append({'nick': nick, 'filler': filler, 'time': str(r[ci['time']] or '')[:10],
                 'name': str(r[ci['name']] or '').strip(), 'company': str(r[ci['company']] or '').strip(),
                 'audit': str(r[ci['audit']] or '').strip(), 'know': str(r[ci['know']] or '').strip()})

# 归属规则（文档口径）：know含混沌→混沌学院；否则昵称匹配→活码活动；否则自然流量
def attrib(a):
    if '混沌' in a['know']: return '混沌学院'
    ch = nick2chan.get(a['nick']) or nick2chan.get(a['filler'])
    return EVENT_MAP.get(ch, ch) if ch else '自然流量/未归属'
for a in apps: a['ev'] = attrib(a)

from collections import Counter
apply_per_event, open_per_event = Counter(), Counter()
selfreport_per_event = {}
for a in apps:
    if a['ev'] == '自然流量/未归属': continue
    apply_per_event[a['ev']] += 1
    if a['audit'] == '通过': open_per_event[a['ev']] += 1
    selfreport_per_event.setdefault(a['ev'], Counter())[a['know'] or '未填'] += 1

# 月度趋势（CEO渠道归属的申请）
monthly = {}
for a in apps:
    if a['ev'] == '自然流量/未归属': continue
    m = a['time'][:7]
    if not m: continue
    d = monthly.setdefault(m, {'apply': 0, 'open': 0})
    d['apply'] += 1
    if a['audit'] == '通过': d['open'] += 1

# ===== C: SDR周报 → 转出明细（晚点4人+混沌1人=贾祥轩宇通）=====
sdr = read_xlsx(os.path.join(BASE, '明略科技SDR周报0915.xlsx'))
tout = sdr.get('转出线索', [])
TRANSFER_COMPANIES = ['仁达', '新街口', '爱游智学', '海康威视', '宇通']
transfers_raw = []
for r in tout[1:]:
    g = str(r[6] or '') if len(r) > 6 else ''
    if any(t in g for t in TRANSFER_COMPANIES):
        transfers_raw.append({
            'date': xldate(r[2] if len(r) > 2 else ''), 'name': str(r[3] or ''),
            'company': g, 'channel': str(r[7] or '') if len(r) > 7 else '',
            'product': str(r[9] or '') if len(r) > 9 else '', 'sales': str(r[10] or '') if len(r) > 10 else '',
        })

# ===== 参照层：14家匹配 / 25家未匹配 / 逐活动参考数（交叉验证过，底表=章鱼烧报告+客户跟踪表）=====
MATCHED_14 = [
    ['宇通客车', '🔴 投标', 2, 3, 3, 1, '庞可'],
    ['墨迹天气', '🟡 B类', 0, 1, 1, 0, ''],
    ['金智教育', '🔵 C类', 0, 2, 1, 0, ''],
    ['致远互联', '🔵 C类', 0, 1, 1, 0, ''],
    ['普联香港', '🟡 B类', 0, 1, 1, 0, ''],
    ['混沌学园', '🔵 C类', 0, 1, 1, 0, ''],
    ['中金公司', '🔵 C类', 0, 0, 0, 1, '荣生'],
    ['华泰研究所', '🔵 C类', 0, 0, 0, 1, '李新伦'],
    ['鹏扬基金', '🔵 C类', 0, 1, 1, 0, ''],
    ['卓望', '⚪ D类', 2, 2, 2, 0, ''],
    ['祥承', '⚪ D类', 0, 4, 4, 1, '张晓'],
    ['新世纪医疗集团', '⚪ D类', 0, 0, 0, 1, '张晓（Amy）'],
    ['云迹', '❌ 放弃', 0, 0, 0, 1, '张晓'],
    ['我思科技', '❌ 放弃', 0, 2, 2, 0, ''],
]
UNMATCHED_25 = ['吉利汽车', '三一重工', '南孚电池', '卓正医疗', 'HKIC', '极光湾', '中信资本', '曼伦', 'PPIO',
                '联合影像', '健主任', '刀法咨询', '欢瑞世纪', '青钜科技', '卓越教育', 'Hysan希慎', '得到',
                '方里', '流利说', '香港中企', '海归爸爸', '51World', '元梦灵境', '北京破圈', '西门子']

# 逐活动参考数（已与原始表交叉验证：微伴395→394加微、混沌33/31、昵称匹配89）
REF_EVENTS = {
    '《晚点》头条': dict(adds=198, applies=80, opens=65, transfers=4, match=4, match_names=['宇通客车', '卓望'], method='企微活码扫码', code='2026-05-20',
                       traits='流量最大（占全部活码的50%），但加微→开通转化33%，说明60%+加微后无后续动作；晚点是入口渠道而非认知来源（自报来源中「晚点」仅少数）'),
    'AI生态峰会': dict(adds=88, applies=4, opens=3, transfers=0, match=0, match_names=[], method='企微活码扫码', code='2026-06-19', traits='转化率3%，流量大但转化极低'),
    '国企EMP': dict(adds=56, applies=1, opens=0, transfers=0, match=0, match_names=[], method='企微活码扫码', code='2026-06-28', traits='有申请但零开通，受众与Octo目标客群不匹配'),
    'Octo产品发布': dict(adds=26, applies=4, opens=3, transfers=0, match=0, match_names=[], method='企微活码扫码', code='2026-07-01', traits='小规模但精准，转化率12%'),
    'CAIO峰会': dict(adds=17, applies=0, opens=0, transfers=0, match=0, match_names=[], method='企微活码扫码', code='2026-07-09', traits='加微后零转化'),
    '中欧商学院': dict(adds=8, applies=0, opens=0, transfers=0, match=0, match_names=[], method='企微活码扫码', code='2026-07-01', traits='加微后零转化，受众与Octo目标客群不匹配'),
    '外滩大会': dict(adds=1, applies=0, opens=0, transfers=0, match=0, match_names=[], method='企微活码扫码', code='2026-09-05', traits='加微后零转化'),
    '混沌学院': dict(adds=0, applies=33, opens=31, transfers=1, match=3, match_names=['卓望', '祥承', '混沌学园'], method='社群直发开通链接', code='2026-05~06(估)',
                     traits='通过率全渠道最高（94%），用户自主意愿极强；CEO背书+混沌社群信任度高'),
}

# 转出5人明细（C表抽取+参照报告整合）
TRANSFERS = [
    {'event': '《晚点》头条', 'nick': '朱江', 'name': '朱江', 'company': '北京仁达企业管理咨询有限公司', 'sales': '李金龙', 'product': '灵听工牌', 'match39': ''},
    {'event': '《晚点》头条', 'nick': 'tomma', 'name': '马先生', 'company': '南京新街口百货商店股份有限公司', 'sales': '卢悦', 'product': 'CDP+MA', 'match39': ''},
    {'event': '《晚点》头条', 'nick': '李端', 'name': '李端', 'company': '成都爱游智学科技有限公司', 'sales': '刘智行', 'product': 'AI短剧', 'match39': ''},
    {'event': '《晚点》头条', 'nick': 'Candy', 'name': '史女士', 'company': '杭州海康威视数字技术股份有限公司', 'sales': '赵莹', 'product': '', 'match39': ''},
    {'event': '混沌学院', 'nick': '贾祥轩', 'name': '贾祥轩', 'company': '宇通客车股份有限公司', 'sales': '庞可', 'product': 'Octo', 'match39': '宇通客车'},
]

# ===== 汇总输出 =====
events_out = []
for ev, ref in REF_EVENTS.items():
    sr = [{'src': k, 'n': v} for k, v in selfreport_per_event.get(ev, Counter()).most_common(5)]
    events_out.append({
        'name': ev, **ref,
        'applies_extracted': apply_per_event.get(ev, 0),   # 原始表抽取值（昵称匹配口径）
        'opens_extracted': open_per_event.get(ev, 0),
        'selfReportTop': sr,
    })

report = {
    'meta': {
        'title': 'CEO获客数据分析报告',
        'generatedAt': datetime.date.today().isoformat(),
        'dataCutoff': '2026-09-15（SDR周报）/ 2026-09-18（OCTO申请表）',
        'analyst': '千寻（数据管线：章鱼烧《CEO获客取数逻辑》）',
        'chain': ['活动出席', '扫码加微', 'OCTO申请', '审核开通', 'SDR转出销售', '匹配39家大客户'],
        'sources': ['A 微伴客户导出×8（加微→活动归因）', 'B OCTO内测申请表226行（申请→审核开通）', 'C SDR周报（转出销售）', 'D 渠道活码列表（活码→活动映射）'],
        'provenance': '加微/混沌/月度趋势/自报来源由原始表程序化抽取；逐活动参考数与14家匹配为交叉验证后的参照值（底表：CEO获客数据分析报告+客户跟踪表）；漏斗实时数取自系统CEO活动数据',
        'corrections': ['源文档勘误：AI生态峰会申请43→4、国企EMP申请10→1', '混沌+晚点开通贡献实为94%（非96%）', '沉睡占比实为77%（非60%）'],
    },
    'overview': {
        'events': 8, 'livecodeAdds': 394, 'applyTotal': 122, 'openTotal': 102, 'transferTotal': 5,
        'matched': 14, 'unmatched': 25, 'livecodeApply': 89, 'livecodeOpen': 71, 'sleeping': 305,
    },
    'monthlyTrend': [{'month': m, **monthly[m]} for m in sorted(monthly)],
    'events': events_out,
    'transfers': TRANSFERS,
    'transfersRaw': transfers_raw,
    'matched14': MATCHED_14,
    'unmatched25': UNMATCHED_25,
    'insights': {
        'ranking': [
            ['🥇', '混沌学院', '33申请/31开通/94%通过率', '质量最高，CEO社群信任背书'],
            ['🥈', '《晚点》头条', '198加微/65开通/33%开通率', '流量最大，转化率中等'],
            ['🥉', 'Octo产品发布', '26加微/3开通/12%开通率', '小规模但精准'],
            ['4', 'AI生态峰会', '88加微/3开通/3%', '流量大但转化极低'],
            ['5', '国企EMP', '56加微/0开通/0%', '零转化'],
            ['6', 'CAIO/中欧/外滩', '26加微/0开通/0%', '零转化'],
        ],
        'findings': [
            {'title': '活动获客≠大客户获取', 'body': '39家大客户中25家（64%）完全不在线上漏斗里；活码渠道仅匹配到4家（宇通、卓望等）且都是个人注册非组织决策。大客户主要靠CEO/高管人脉直推，线上活动是品牌曝光+长尾线索池。', 'level': 'insight'},
            {'title': '活动质量两极分化', 'body': '混沌+晚点贡献94%的开通量（96/102），其余6个活动几乎零转化。建议聚焦高质量渠道（科技/创业社群），减少泛行业活动投入。', 'level': 'success'},
            {'title': '77%加微客户沉睡', 'body': '394个活码加微中305人（77%）加微后零后续动作。建议加微后7天内做一轮SDR外呼/私信激活。', 'level': 'warning'},
            {'title': '混沌模式值得复制', 'body': '不走活码直接发开通链接，94%通过率。本质：CEO在高信任社群里分享→直接引导注册，跳过「加微」中间环节。建议在其他高质量社群（杨三角、CEO圈子）复制「分享+直接开通」模式。', 'level': 'success'},
        ],
    },
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=1)

# ===== 校验输出 =====
print(f"✔ 写出 {OUT}")
print(f"微伴加微(去重): {len(contacts)} | 逐活动: {adds_per_event}")
print(f"申请表: {len(apps)}行 | 混沌know: {sum(1 for a in apps if '混沌' in a['know'])} | 昵称匹配活码: {sum(1 for a in apps if nick2chan.get(a['nick']) or nick2chan.get(a['filler']))}")
print(f"活码渠道申请(归属口径): {dict(apply_per_event)}")
print(f"混沌: 申请{apply_per_event['混沌学院']}/开通{open_per_event['混沌学院']}")
print(f"月度: {[(m, d['apply'], d['open']) for m, d in sorted(monthly.items())]}")
print(f"SDR转出明细抽取: {len(transfers_raw)}条")
assert len(contacts) == 395, f"微伴行数异常 {len(contacts)}"
assert apply_per_event['混沌学院'] == 33 and open_per_event['混沌学院'] == 31, "混沌口径异常"
# 口径校验：按人去重的CEO渠道申请(混沌优先归属)
ceo_distinct = [a for a in apps if a['ev'] != '自然流量/未归属']
overlap = sum(1 for a in apps if '混沌' in a['know'] and (nick2chan.get(a['nick']) or nick2chan.get(a['filler'])))
print(f"按人去重CEO渠道申请: {len(ceo_distinct)} | 文档口径122 | 双渠道重复计数: {overlap}人")
assert apply_per_event['混沌学院'] == 33 and open_per_event['混沌学院'] == 31
assert len(ceo_distinct) == 100, f"去重口径异常 {len(ceo_distinct)}"
print("✔ 全部校验通过")
report['meta']['corrections'].append('口径提示：文档122申请=活码89+混沌33，其中22人既扫活码又自报混沌来源被重复计数，按人去重=100')
report['overview']['applyDistinct'] = len(ceo_distinct)
report['overview']['doubleCount'] = overlap
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print("✔ 勘误+去重口径已写回 ceoReport.json")
