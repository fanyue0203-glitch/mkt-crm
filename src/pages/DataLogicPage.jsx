import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setHeader } from '../api.js';
import { Err, Loading } from '../components/Common.jsx';

const short = (s, n = 100) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };

// 取数优先级映射（KR2取数逻辑文档原文）
const FIELD_SOURCES = [
  ['行业 / 基本信息', '① 图谱 v3 → ② Onboarding 表 → 公开信息', '客户全称、行业标签、企业性质'],
  ['我方负责人', '⑤ 周会最新决策 → ② Onboarding 表 → ① 图谱', '周会中有负责人调整的以最新为准'],
  ['组织架构 / 关键联系人', '③ 客户架构表 → ④ 子区消息推断 → ① 图谱', '仅吉利/金智/宇通/南孚有架构表，其余靠消息提取'],
  ['合作定位 / 客户关系', '① 图谱 → ⑤ 周会定调 → ④ 消息推断', '如姜平定调"战略合作伙伴"or"不付费不投入"'],
  ['需求场景', '④ 子区消息（客户原话+售前反馈）→ ① 图谱', '主要来自实际沟通，最鲜活的数据'],
  ['推进时间线', '④ 消息时间戳 + ⑤ 周会纪要 → 交叉排列', '按时间倒序，标注关键节点'],
  ['成果 / 金额', '⑤ 周会确认 → ① 图谱 → ④ 消息中提及', '签约金额以周会/合同为准'],
  ['卡点 / 风险', '④ 消息中客户反馈 + ⑤ 周会讨论的阻碍', '区分客户侧卡点 vs 我方侧卡点'],
  ['下一步', '⑤ 周会最新指令 → ④ 消息中约定', '以最新一期周会决策为准'],
];

const SOURCE_FILES = [
  ['①', '大客户图谱 v3', '14家 (8主跟+1战败+5周会提及)', '客户基本信息、跟进状态、负责人、合作定位', 'OCTO大客户拓展图谱.xlsx'],
  ['②', 'Onboarding 表', '15家', '优先级(S/A/B)、负责人、决策状态(跟进/放弃/on hold)', 'Octo_Onboarding_0916.xlsx'],
  ['③', '客户架构表', '4家（吉利/金智/宇通/南孚）', '组织架构树、关键联系人、Decision Maker 标注', 'Octo_客户架构_0916.xlsx'],
  ['④', 'Octo 群 + 子区消息扫描', '全部活跃子区共486条消息', '实际沟通内容、需求细节、卡点、时间线、客户原话', 'scan_*.md × 8'],
  ['⑤', '3 期周会纪要 (8/31、9/7、9/14)', '全部在讨客户', '姜平决策指令、状态更新、负责人调整、战略定调', 'scan_周例会.md'],
];

const STAGE_RULES = [
  ['✅ 已签约/交付', 'A 类', '有合同签署 / 已回款 / 交付中', '3 家'],
  ['🔴 投标进行中', '投标', '已进入正式招投标流程', '1 家'],
  ['🟡 B 类重点推进', 'B 类', '有明确需求 + 在推进 + 有预算信号', '5-7 家'],
  ['🔵 C 类基础跟进', 'C 类', '有接触但推进缓慢 / 预算不明 / on hold', '9-11 家'],
  ['⚪ D 类初期/观察', 'D 类', '初期接触 / 沉默 / 低活跃', '7 家'],
  ['❌ 放弃/战败', '放弃', '明确放弃原因：竞品锁定 / 无预算 / 战败 / 姜平决策"不再投入"', '12 家'],
];

const LIMITS = [
  ['子区消息 ≠ 全貌', '线下/电话/微信沟通不在扫描范围', '负责人口头补充 → 人工录入'],
  ['放弃客户信息薄', '12 家中 5 家仅一行表格，缺深度原因', '周会追溯 / 负责人补录'],
  ['组织架构不完整', '仅 4 家有架构表，其余靠消息推断', '需各负责人补充客户组织架构'],
  ['吉利/极光湾资料未到位', 'Elva 详细资料未到位，报告中为现有数据版本', '等 Elva 补充后更新'],
  ['微伴↔SDR 数量不对齐', '394 vs 124，SDR 无昵称字段无法 1:1 匹配', '需 SDR 团队补充对应字段'],
];

export default function DataLogicPage() {
  const navigate = useNavigate();
  useEffect(() => {
    setHeader('📐 KR2 取数逻辑与数据架构', <>
      <button className="btn btn-secondary" onClick={() => navigate('/octo')}>← 返回 Octo 大客户</button>
    </>);
  }, []);

  return (
    <div className="panorama">
      <div className="section-card" id="dl-1">
        <div className="section-header"><h3>一、数据来源总览</h3><span className="section-count">5 个独立渠道 · 去重合并 + 交叉验证</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>源</th><th>数据源</th><th>覆盖范围</th><th>提供字段</th><th>打包文件</th></tr>
            <tbody>
              {SOURCE_FILES.map((s, i) => (
                <tr key={i}>
                  <td><span className="tag tag-blue" style={{ fontWeight: 700 }}>{s[0]}</span></td>
                  <td><strong>{s[1]}</strong></td>
                  <td>{s[2]}</td>
                  <td style={{ fontSize: 12 }}>{s[3]}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s[4]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        </div>
      </div>

      <div className="section-card" id="dl-2">
        <div className="section-header"><h3>二、客户池合并逻辑</h3><span className="section-count">从 25 → 39 的过程</span></div>
        <div className="section-body">
          <div className="conclusion-box">
            <strong>合并链路：</strong>①图谱v3（14家）＋ ②Onboarding表（15家）→ 去重 → 基础池25家 ＋ ④⑤消息/周会补充发现14家 → 最终39家
          </div>
          <div className="highlight-box">
            <strong>去重规则：</strong>同一客户在多个数据源出现 → 合并为一条，字段取最新/最完整值；①②重叠的客户（如南孚、吉利、金智等）→ ①提供定位/跟进描述，②提供优先级/决策状态。补充的14家来源：周会讨论中提到但未在①②中出现的客户（如香港中企、海归爸爸、云迹、51World等放弃客户）+ CEO获客漏斗中触达的客户。
          </div>
        </div>
      </div>

      <div className="section-card" id="dl-3">
        <div className="section-header"><h3>三、每家客户卡片取数映射</h3><span className="section-count">字段 → 数据源优先级（高→低）</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>卡片字段</th><th>取数优先级（高→低）</th><th>说明</th></tr>
            <tbody>
              {FIELD_SOURCES.map((f, i) => (
                <tr key={i}>
                  <td><strong>{f[0]}</strong></td>
                  <td><span className="tag tag-green" style={{ fontSize: 11 }}>{f[1]}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f[2]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        </div>
      </div>

      <div className="section-card" id="dl-4">
        <div className="section-header"><h3>四、客户分层判定逻辑</h3><span className="section-count">周会决策 > Onboarding优先级 > 子区活跃度</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>分类</th><th>标签</th><th>判定标准</th><th>数量</th></tr>
            <tbody>
              {STAGE_RULES.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r[0]}</strong></td>
                  <td><span className="tag tag-blue">{r[1]}</span></td>
                  <td style={{ fontSize: 12 }}>{r[2]}</td>
                  <td>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
          <div className="highlight-box" style={{ marginTop: 12 }}>
            <strong>分类判定的数据依据：</strong>①首先看⑤周会姜平决策（如 9/7："不能付费的客户不再投入时间"）②其次看②Onboarding 表优先级（S → 重点，B → 一般）+ 决策状态（跟进/放弃/on hold）③最后看④子区活跃度（消息量、最近消息时间、是否有实质推进）。
          </div>
          <div className="highlight-box warning" style={{ marginTop: 8 }}>
            <strong>升降级触发：</strong>周会指令 &gt; 签约/投标事件 &gt; 预算确认/否定 &gt; 长期沉默
          </div>
        </div>
      </div>

      <div className="section-card" id="dl-5">
        <div className="section-header"><h3>五、已知局限 & 数据缺口</h3><span className="section-count">5 项已知局限 · 补救方案</span></div>
        <div className="section-body">
          <div className="card"><div className="table-wrap"><table>
            <tr><th>局限</th><th>影响</th><th>补救方案</th></tr>
            <tbody>
              {LIMITS.map((l, i) => (
                <tr key={i}>
                  <td><strong>⚠️ {l[0]}</strong></td>
                  <td style={{ fontSize: 12 }}>{l[1]}</td>
                  <td style={{ fontSize: 12, color: 'var(--success)' }}>{l[2]}</td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--text-muted)' }}>
        🐙 KR2 取数逻辑与数据架构 · 数据截止 2026-09-17 · 底稿存档 knowledge/kr2-data-foundation/（27个文件）
      </div>
    </div>
  );
}
