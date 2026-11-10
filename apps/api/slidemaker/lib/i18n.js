'use strict';

// Fixed labels that layouts draw themselves, in the deck's language (deck.lang).
const LABELS = {
  challenge: { ja: '課題', zh: '挑战', en: 'Challenge' },
  solution: { ja: '施策', zh: '举措', en: 'Solution' },
  outcome: { ja: '効果', zh: '成效', en: 'Outcome' },
  features: { ja: '活用した機能', zh: '使用功能', en: 'Features used' },
  impact: { ja: '影響', zh: '影响', en: 'Impact' },
  impactLong: { ja: 'お客様への影響', zh: '对客户的影响', en: 'Customer impact' },
  actionLong: { ja: '必要なご対応', zh: '需要的操作', en: 'Required action' },
  what: { ja: '変更点', zh: '变更内容', en: 'What changes' },
  background: { ja: '背景', zh: '背景', en: 'Background' },
  timing: { ja: '提供時期', zh: '上线时间', en: 'Timing' },
  scope: { ja: '対象', zh: '适用范围', en: 'Scope' },
  change: { ja: '変更', zh: '变更', en: 'Change' },
  when: { ja: 'こんなとき', zh: '场景', en: 'When' },
  roles: { ja: '役割分担', zh: '分工', en: 'Ownership' },
  asIs: { ja: 'As-Is（現状）', zh: '现状', en: 'As-is' },
  toBe: { ja: 'To-Be（あるべき姿）', zh: '目标状态', en: 'To-be' },
  total: { ja: '合計', zh: '合计', en: 'Total' },
  conversion: { ja: '全体転換率', zh: '整体转化率', en: 'Overall conversion' },
  insights: { ja: 'ポイント', zh: '关键洞察', en: 'Key insights' },
  agenda: { ja: 'AGENDA', zh: '目录', en: 'Agenda' },
  done: { ja: '達成', zh: '已达成', en: 'Achieved' },
  step: { ja: 'STEP', zh: 'STEP', en: 'STEP' },
  thanks: { ja: 'THANK YOU', zh: 'THANK YOU', en: 'THANK YOU' },
  chapter: { ja: 'CHAPTER', zh: 'CHAPTER', en: 'CHAPTER' },
};

function translator(lang) {
  return (key) => {
    const entry = LABELS[key];
    if (!entry) return key;
    return entry[lang] || entry.en;
  };
}

module.exports = { LABELS, translator };
