import { describe, expect, it } from 'vitest';
import { ProviderConfigSchema } from '../src/main/providers/provider-config';

describe('Model Studio provider configuration', () => {
  it('accepts only HTTPS Alibaba Cloud compatible-mode endpoints', () => {
    expect(ProviderConfigSchema.parse({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/', region: 'cn-beijing'
    }).baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(ProviderConfigSchema.parse({
      baseUrl: 'https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', region: 'cn-beijing'
    }).baseUrl).toBe('https://ws-example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
  });

  it.each([
    'http://dashscope.aliyuncs.com/compatible-mode/v1',
    'https://example.com/compatible-mode/v1',
    'https://evilmaas.aliyuncs.com/compatible-mode/v1',
    'https://dashscope.aliyuncs.com.evil.example/compatible-mode/v1'
  ])('rejects unsafe endpoint %s', (baseUrl) => {
    expect(() => ProviderConfigSchema.parse({ baseUrl, region: 'cn-beijing' })).toThrow();
  });
});
