import React from 'react';

type Props = {
  lang: 'zh' | 'en';
  mediumCount: number;
};

/**
 * Design: medium reminders are not sent via Web Push but must be visible on the homepage.
 */
export function MediumPriorityBanner({ lang, mediumCount }: Props) {
  if (mediumCount <= 0) return null;

  const title =
    lang === 'zh'
      ? '中优先级更新（不推送 Web Push）'
      : 'Medium-priority updates (no Web Push)';
  const body =
    lang === 'zh'
      ? `本页共有 ${mediumCount} 条中优先级条目；按设计仅展示在首页/时间线，不会进入浏览器推送。`
      : `${mediumCount} medium-priority item(s) on this page — shown here and on the timeline only, not via browser push.`;

  return (
    <div
      data-testid="medium-priority-banner"
      style={{
        marginBottom: 14,
        padding: 12,
        borderRadius: 10,
        border: '1px solid #c5cae9',
        background: 'linear-gradient(90deg, #f3e5f5 0%, #e8eaf6 100%)',
        color: '#311b92',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.45 }}>{body}</div>
    </div>
  );
}
