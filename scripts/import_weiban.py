#!/usr/bin/env python3
"""导入微伴客户明细到ceo_event_weiban表"""
import openpyxl, glob, sqlite3, re, os
from datetime import datetime

DB = '/home/mlclaw/.openclaw/workspace/mkt-crm/data/mkt-crm.db'
DIR = '/home/mlclaw/.openclaw/workspace/data/ceo-package/weiban'

conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("DELETE FROM ceo_event_weiban")

# 渠道关键词 → 活动id映射
cur.execute("SELECT id, name FROM ceo_events WHERE key_messages='吴明辉(CEO)'")
events = {name: eid for eid, name in cur.fetchall()}

def find_event_id(channel_str):
    for name, eid in events.items():
        # 取活动名前几个字符做匹配
        for kw in ['晚点', 'AI生态', 'EMP', '国企', '产品发布', 'CAIO', '中欧', '外滩']:
            if kw in channel_str and kw in name:
                return eid
    return None

def norm_time(v):
    if not v: return ''
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d %H:%M')
    s = str(v).strip()
    return s[:16] if s else ''

total = 0
files = sorted(glob.glob(os.path.join(DIR, '*.xlsx')))
# 去重：微伴-客户列表数据导出.xlsx(203行)和-7重复，只用-1~-7
seen_channels = set()
for f in files:
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    
    event_id = None
    count = 0
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 5: continue  # 跳过标题行
        vals = list(row)
        if len(vals) < 9: continue
        nickname = str(vals[0] or '').strip()
        if not nickname or nickname in ('全部客户', ''): continue
        
        add_channel = str(vals[8] or '').strip()
        
        # 确定活动id（第一行数据时确定）
        if event_id is None:
            event_id = find_event_id(add_channel)
            if event_id is None:
                # 从文件名判断
                fn = os.path.basename(f)
                if '-1.' in fn: event_id = next((v for k,v in events.items() if '外滩' in k), None)
                elif '-2.' in fn: event_id = next((v for k,v in events.items() if '中欧' in k), None)
                elif '-3.' in fn: event_id = next((v for k,v in events.items() if 'AI生态' in k or '全球' in k), None)
                elif '-4.' in fn: event_id = next((v for k,v in events.items() if 'EMP' in k or '国企' in k), None)
                elif '-5.' in fn: event_id = next((v for k,v in events.items() if 'CAIO' in k), None)
                elif '-6.' in fn: event_id = next((v for k,v in events.items() if '产品发布' in k or 'Octo' in k), None)
                elif '-7.' in fn: event_id = next((v for k,v in events.items() if '晚点' in k), None)
                else: continue
            if event_id and event_id in seen_channels:
                # 跳过重复文件（晚点203行重复）
                break
            if event_id: seen_channels.add(event_id)
        
        if not event_id: continue
        
        service = str(vals[1] or '').strip()
        rating = str(vals[3] or '').strip()
        tags = str(vals[4] or '').strip()
        status = str(vals[5] or '').strip()
        add_time = norm_time(vals[6])
        last_chat = norm_time(vals[7])
        
        cur.execute("""INSERT INTO ceo_event_weiban (event_id, nickname, customer_service, rating, tags, status, add_time, last_chat_time, add_channel)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (event_id, nickname[:50], service[:30], rating[:10], tags[:500], status[:20], add_time, last_chat, add_channel[:100]))
        count += 1
    
    if count > 0:
        ename = next((k for k,v in events.items() if v == event_id), '?')
        print(f"  {os.path.basename(f)}: {count}条 → {ename}")
        total += count
    wb.close()

conn.commit()

# 统计
print(f"\n合计导入: {total}条")
cur.execute("""SELECT e.name, COUNT(w.id) 
    FROM ceo_events e LEFT JOIN ceo_event_weiban w ON e.id = w.event_id 
    WHERE e.key_messages='吴明辉(CEO)' GROUP BY e.id ORDER BY e.date""")
for n, c in cur.fetchall():
    print(f"  {n[:25]:<25}: {c}条")

conn.close()
