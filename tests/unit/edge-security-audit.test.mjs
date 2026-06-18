import { describe, expect, it } from 'vitest';
import { parseJwtDisabledFunctions } from '../../scripts/edge-security-audit.mjs';

describe('edge security configuration parser', () => {
  it('collects only explicitly JWT-disabled functions', () => {
    const config = `
[functions.secure]
verify_jwt = true

[functions.system]
verify_jwt = false
`;
    expect(parseJwtDisabledFunctions(config)).toEqual(['system']);
  });

  it('sorts function names for deterministic policy comparison', () => {
    const config = `
[functions.zeta]
verify_jwt = false
[functions.alpha]
verify_jwt = false
`;
    expect(parseJwtDisabledFunctions(config)).toEqual(['alpha', 'zeta']);
  });
});
