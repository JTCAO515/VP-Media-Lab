import type { GuideEvent, GuidedProductionRunV1 } from '@visepanda/media-lab-domain';

export function GuideStepView({ run, onEvent }: { run: GuidedProductionRunV1; onEvent: (event: GuideEvent) => void }): JSX.Element {
  const step = run.steps.find((candidate) => ['active', 'ready_for_confirmation', 'blocked'].includes(candidate.state));
  if (!step) return <div className="empty">本次制作流程已完成。</div>;
  const at = () => new Date().toISOString();
  if (step.state === 'blocked') return <section className="card"><span className="eyebrow">制作引导</span><h2>{step.title}</h2><p>当前步骤已暂停：{step.blockedReason}</p><button className="primary" onClick={() => onEvent({ type: 'resume', stepId: step.id, at: at() })}>恢复这一步</button></section>;
  const automaticWaiting = step.evidenceMode === 'automatic' && step.state !== 'ready_for_confirmation';
  return <section className="card"><span className="eyebrow">制作引导 · 当前第 {run.steps.indexOf(step) + 1} 步 / 共 {run.steps.length} 步</span><h2>{step.title}</h2><p>{step.instruction}</p><div className="notice"><strong>为什么：</strong>{step.why}<br /><strong>完成标志：</strong>{step.expectedResult}</div>{automaticWaiting && <div className="notice">正在等待自动检查完成；通过后才能确认。</div>}<div className="form-row"><button className="primary" disabled={automaticWaiting} onClick={() => onEvent({ type: 'confirm', stepId: step.id, at: at() })}>确认完成</button><button className="secondary" onClick={() => onEvent({ type: 'block', stepId: step.id, at: at(), reason: '需要帮助后再继续' })}>我遇到问题</button><button className="secondary" onClick={() => onEvent({ type: 'block', stepId: step.id, at: at(), reason: '稍后继续' })}>稍后继续</button>{step.optional && <button className="secondary" onClick={() => onEvent({ type: 'skip_optional', stepId: step.id, at: at(), reason: '本次暂不需要' })}>跳过可选步骤</button>}</div></section>;
}
