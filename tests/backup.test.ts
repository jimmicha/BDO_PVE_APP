import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
// @ts-expect-error Shared Node operation helper.
import {encrypt,decrypt} from '../scripts/backup-crypto.mjs';
describe('encrypted backups',()=>{
  it('restores the exact payload and authenticates both key and ciphertext',()=>{
    const key=randomBytes(32).toString('hex'),data=Buffer.from('private player records'),encrypted=encrypt(data,key);
    expect(encrypted.includes(data)).toBe(false);expect(decrypt(encrypted,key)).toEqual(data);
    expect(()=>decrypt(encrypted,randomBytes(32).toString('hex'))).toThrow();
    const altered=Buffer.from(encrypted);altered[altered.length-1]^=1;expect(()=>decrypt(altered,key)).toThrow();
  });
});
