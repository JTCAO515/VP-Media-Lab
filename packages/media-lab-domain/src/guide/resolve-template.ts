import { WorkflowTemplateV1Schema, type WorkflowTemplateV1 } from './schemas';

export function resolveWorkflow(untrustedTemplate: WorkflowTemplateV1, projectFacts: Record<string, string>): WorkflowTemplateV1 {
  const template = WorkflowTemplateV1Schema.parse(untrustedTemplate);
  const interpolate = (value: string) => value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key: string) => projectFacts[key] ?? '');
  return WorkflowTemplateV1Schema.parse({
    ...template,
    title: interpolate(template.title),
    steps: template.steps.map((step) => ({ ...step, title: interpolate(step.title), instruction: interpolate(step.instruction), why: interpolate(step.why), expectedResult: interpolate(step.expectedResult) }))
  });
}
