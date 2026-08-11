import { z } from 'zod';

const AllowedProviderUrlSchema = z.string().url().transform((value, context) => {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const allowedHost = hostname === 'dashscope.aliyuncs.com' || hostname.endsWith('.maas.aliyuncs.com');
  const normalizedPath = url.pathname.replace(/\/+$/, '');
  if (
    url.protocol !== 'https:' ||
    !allowedHost ||
    url.username !== '' ||
    url.password !== '' ||
    (url.port !== '' && url.port !== '443') ||
    url.search !== '' ||
    url.hash !== '' ||
    normalizedPath !== '/compatible-mode/v1'
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'UNSAFE_PROVIDER_ENDPOINT' });
    return z.NEVER;
  }
  return `https://${hostname}${url.port ? `:${url.port}` : ''}${normalizedPath}`;
});

export const ProviderConfigSchema = z.object({
  baseUrl: AllowedProviderUrlSchema,
  region: z.string().regex(/^cn-[a-z0-9-]{2,32}$/)
}).strict();

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const DefaultProviderConfig: ProviderConfig = ProviderConfigSchema.parse({
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  region: 'cn-beijing'
});
