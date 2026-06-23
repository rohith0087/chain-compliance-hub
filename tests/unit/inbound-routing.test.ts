import { describe,expect,it } from 'vitest';
import { encodeCrockfordBase32,parseInboundReplyAddress } from '../../supabase/functions/_shared/inboundRouting';

describe('inbound reply routing',()=>{
  it('encodes 128 bits as a 26 character lowercase code',()=>{
    const code=encodeCrockfordBase32(new Uint8Array(16).fill(255));
    expect(code).toHaveLength(26);expect(code).toMatch(/^[0-9a-hjkmnp-tv-z]+$/);
  });
  it('accepts the enterprise coded address',()=>{
    const token='0'.repeat(26);
    expect(parseInboundReplyAddress(`reply+r2c-${token}@inbound.tracer2c.com`,'inbound.tracer2c.com')).toBe(token);
  });
  it('accepts the legacy 64 hex address during migration',()=>{
    const token='a'.repeat(64);expect(parseInboundReplyAddress(`reply+${token}@inbound.tracer2c.com`,'inbound.tracer2c.com')).toBe(token);
  });
  it('rejects another domain and malformed codes',()=>{
    expect(parseInboundReplyAddress('reply+r2c-short@inbound.tracer2c.com','inbound.tracer2c.com')).toBeNull();
    expect(parseInboundReplyAddress(`reply+r2c-${'0'.repeat(26)}@example.com`,'inbound.tracer2c.com')).toBeNull();
  });
});
