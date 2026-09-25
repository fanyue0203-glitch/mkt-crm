#!/usr/bin/env python3
"""用CEO获客数据包更新活动数据和线索"""
import sqlite3
import csv
import os

DB = '/home/mlclaw/.openclaw/workspace/mkt-crm/data/mkt-crm.db'
CSV_PATH = '/home/mlclaw/.openclaw/workspace/data/ceo-package/客户跟踪表.csv'

conn = sqlite3.connect(DB)
cur = conn.cursor()

# ===== 1. 更新CEO活动精确漏斗数据（来自分析报告）=====
event_data = [
    # name, date, event_type, wechat_followers, registrations, activations, sql_count, audience_count, notes
    ('《晚点》头条-octo体验', '2026-05-20', '其他', 198, 80, 65, 4, 198,
     '流量最大（占全部活码的50%），加微→开通转化33%。\n自报来源TOP：混沌8人/官网3人/网络3人/微信公众号3人/播客3人。\n晚点是入口渠道而非认知来源（自报来源中"晚点"仅6人）。\n\n转出明细(4人)：\n• 朱江(北京仁达企业管理咨询有限公司)→李金龙(灵听工牌)\n• 马先生(南京新街口百货商店股份有限公司)→卢悦(CDP+MA)\n• 李端(成都爱游智学科技有限公司)→刘智行(AI短剧)\n• 史女士(杭州海康威视数字技术股份有限公司)→赵莹'),

    ('全球AI生态与创新峰会20260808', '2026-06-19', '峰会', 88, 4, 3, 0, 88,
     '转化率仅3%，加微后申请率5%，转化极低。\n泛行业峰会受众与Octo目标客群匹配度不高。'),

    ('国有企业领导人员经营管理培训班（EMP）', '2026-06-28', '其他', 56, 1, 0, 0, 56,
     '有1人申请但零开通。国企班学员决策链长，短期内难转化。'),

    ('Octo产品发布（明略公众号）', '2026-07-01', '发布会', 26, 4, 3, 0, 26,
     '转化率12%，小规模但精准。公众号受众是已有认知的群体。'),

    ('CAIO峰会', '2026-07-09', '峰会', 17, 0, 0, 0, 17,
     '加微后零申请零转化，可能是活动受众（传统IT/CDO）与Octo目标客群不匹配。'),

    ('中欧商学院0825', '2026-07-01', '其他', 8, 0, 0, 0, 8,
     '加微后零转化，商学院校友群体短期需求不明确。'),

    ('外滩大会', '2026-09-05', '论坛', 1, 0, 0, 0, 1,
     '刚举办不久，仅1人加微，后续待观察。'),

    ('混沌学院', '2026-06', '沙龙', 0, 33, 31, 1, 33,
     '🔥 全渠道转化率最高：33申请/31开通/1转出，通过率94%！\n\n关键成功因素：\n• 不走活码，混沌群内直接分享OCTO开通邀请链接\n• CEO在高信任社群做分享→直接引导注册，跳过"加微"中间环节\n• 用户自主意愿极强，CEO背书+混沌社群信任度高\n• 39家大客户匹配3家：卓望/祥承/混沌学园\n\n转出明细(1人)：张晓跟进(祥承)'),
]

updated = 0
for name, date, etype, wf, reg, act, sql, aud, notes in event_data:
    cur.execute("""UPDATE ceo_events SET 
        wechat_followers=?, registrations=?, activations=?, sql_count=?, 
        audience_count=?, notes=?, event_type=?, key_messages='吴明辉(CEO)', status='已结束'
        WHERE name LIKE ?""", (wf, reg, act, sql, aud, notes, etype, f'%{name.split("-")[0][:4]}%' if '-' in name else name[:4]))
    if cur.rowcount > 0:
        updated += cur.rowcount
    else:
        # 模糊匹配兜底
        cur.execute("SELECT id, name FROM ceo_events WHERE key_messages='吴明辉(CEO)'")
        all_names = {r[1]: r[0] for r in cur.fetchall()}
        print(f"  未精确匹配: {name}")
        for n, i in all_names.items():
            print(f"    可用: id={i} name={n}")

print(f"更新活动漏斗数据: {updated}条")

# ===== 2. 更新混沌学院的精确匹配（混沌不在之前的关键词里）=====
# 给混沌学院活动加上特定线索来源标记
# 先查混沌活动id
cur.execute("SELECT id FROM ceo_events WHERE name LIKE '%混沌%'")
row = cur.fetchone()
if row:
    chaos_id = row[0]
    # 混沌学院来源的线索：Octo体验中可能包含混沌的
    # 根据报告，混沌转出1人（祥承→张晓），先标记
    print(f"混沌学院活动id={chaos_id}")

# ===== 3. 处理客户跟踪表CSV - 更新39家大客户数据 =====
# 读取CSV编码
import io
accounts_updated = 0
accounts_created = 0

with open(CSV_PATH, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        company = row.get('客户名称','').strip()
        if not company: continue
        
        industry = row.get('行业','').strip()
        tier_raw = row.get('客户分层(A类已部署出问题/B类落地推进中/C类线索/D类战略储备)','').strip()
        source = row.get('来源渠道','').strip()
        stage = row.get('当前阶段(认知/兴趣/试用/POC/签约/交付)','').strip()
        status = row.get('合作状态(冷/温/热/停滞/已签约/交付中)','').strip()
        needs = row.get('关键场景/需求','').strip()
        painpoint = row.get('客户痛点','').strip()
        ai_progress = row.get('AI Native进展','').strip()
        octo_status = row.get('OCTO使用进展和反馈','').strip()
        owner = row.get('明略侧服务人员/Owner','').strip()
        contacts = row.get('客户侧关键联系人','').strip()
        competitors = row.get('竞争对手情况','').strip()
        next_step = row.get('下一步动作','').strip()
        blockers = row.get('卡点/风险','').strip()
        notes = row.get('备注','').strip()

        # 分层映射
        tier_map = {'A类已部署出问题':'S','B类落地推进中':'B','C类线索':'C','D类战略储备':'D'}
        tier = tier_map.get(tier_raw, 'C')
        
        # 客户阶段映射
        stage_map = {'签约':'已签约','交付':'交付中','POC':'B类重点推进','试用':'POC中'}
        if '已签约' in status or status == '已签约':
            customer_stage = '已签约'
        elif '交付' in status:
            customer_stage = '交付中'
        elif '热' in status and stage in ('POC',):
            customer_stage = 'B类重点推进'
        elif '温' in status and stage in ('POC','试用'):
            customer_stage = 'POC中'
        elif '停滞' in status or '冷' in status:
            customer_stage = 'D类观察'
        else:
            customer_stage = 'C类跟进'

        # 检查是否已存在
        cur.execute("SELECT id FROM accounts WHERE company_name LIKE ?", (f'%{company[:4]}%',))
        existing = cur.fetchone()
        
        if existing:
            aid = existing[0]
            cur.execute("""UPDATE accounts SET 
                industry=COALESCE(NULLIF(?, ''), industry),
                tier=?, source=?, customer_stage=?, octo_status=?,
                assigned_to=?, needs_summary=?, core_painpoint=?,
                competitors=?, blockers=?, next_step=?,
                ecosystem_lock=?, lessons_learned=?, notes=?
                WHERE id=?""",
                (industry, tier, source, customer_stage, octo_status[:500] if octo_status else '',
                 owner.split('/')[0].strip() if owner else '', needs[:500] if needs else '',
                 painpoint[:300] if painpoint else '',
                 competitors[:200] if competitors else '', blockers[:300] if blockers else '',
                 next_step[:300] if next_step else '',
                 f"合作状态:{status}|AI进展:{ai_progress[:200]}" if ai_progress else '',
                 f"联系人:{contacts[:200]}" if contacts else '',
                 notes[:200] if notes else '', aid))
            accounts_updated += 1
        else:
            # 不自动创建，避免重复
            print(f"  未找到客户: {company}")

print(f"更新大客户数据: {accounts_updated}条")

conn.commit()

# 验证最终数据
print("\n===== CEO活动最终数据验证 =====")
cur.execute("""SELECT id, name, wechat_followers, registrations, activations, sql_count 
    FROM ceo_events WHERE key_messages='吴明辉(CEO)' ORDER BY date""")
total_wf = total_reg = total_act = total_sql = 0
for r in cur.fetchall():
    print(f"  {r[1][:20]:<20} 加微:{r[2]:>3} 申请:{r[3]:>3} 开通:{r[4]:>3} 转出:{r[5]}")
    total_wf += r[2] or 0; total_reg += r[3] or 0; total_act += r[4] or 0; total_sql += r[5] or 0
print(f"  {'活码合计':<20} 加微:{total_wf:>3} 申请:{total_reg:>3} 开通:{total_act:>3} 转出:{total_sql}")

conn.close()
print("\n数据更新完成")
