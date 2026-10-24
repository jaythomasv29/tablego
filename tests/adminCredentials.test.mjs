import test from 'node:test';
import assert from 'node:assert/strict';
import { validAdminCredentials, adminSessionDuration } from '../src/lib/auth/adminCredentials.ts';

test('legacy admin and configured admin can log in, but mixed credentials fail', () => {
  const previous = { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD };
  try {
    process.env.ADMIN_USERNAME = 'staff';
    process.env.ADMIN_PASSWORD = 'configured-password';
    assert.equal(validAdminCredentials('000', '000'), true);
    assert.equal(validAdminCredentials('staff', 'configured-password'), true);
    assert.equal(validAdminCredentials('000', 'configured-password'), false);
    assert.equal(validAdminCredentials('staff', '000'), false);
    assert.equal(validAdminCredentials('000', 'wrong'), false);
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    assert.equal(validAdminCredentials('000', '000'), true);
    assert.equal(validAdminCredentials('', ''), false);
  } finally {
    for (const [key, value] of [['ADMIN_USERNAME', previous.username], ['ADMIN_PASSWORD', previous.password]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('admin sessions last seven days or 400 days when remembered', () => {
  assert.equal(adminSessionDuration(false), 7 * 86400);
  assert.equal(adminSessionDuration(true), 400 * 86400);
});

test('restaurant PIN uses exactly the last four phone digits, including leading zeros', async () => {
  const { validAdminPin } = await import('../src/lib/auth/adminCredentials.ts');
  assert.equal(validAdminPin('7700', '+16503237700'), true);
  assert.equal(validAdminPin('7700', '(650) 323-7700'), true);
  assert.equal(validAdminPin('0007', '+16503230007'), true);
  for (const pin of ['000', '0000', '77000', ' 7700', '7700 ', '77aa', '']) assert.equal(validAdminPin(pin, '+16503237700'), false);
  assert.equal(validAdminPin('7700', '+16503238888'), false);
  assert.equal(validAdminPin('7700', ''), false);
  assert.equal(validAdminPin('7700', '7700'), false);
});
