import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const magic=Buffer.from('BDOBK001');
function keyBytes(key){if(!/^[a-f0-9]{64}$/i.test(key??''))throw Error('BACKUP_KEY must be a 32-byte hexadecimal key.');return Buffer.from(key,'hex');}
export function encrypt(data,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyBytes(key),iv);cipher.setAAD(magic);const body=Buffer.concat([cipher.update(data),cipher.final()]);return Buffer.concat([magic,iv,cipher.getAuthTag(),body]);}
export function decrypt(data,key){if(data.length<36||!data.subarray(0,8).equals(magic))throw Error('Invalid backup format.');const decipher=createDecipheriv('aes-256-gcm',keyBytes(key),data.subarray(8,20));decipher.setAAD(magic);decipher.setAuthTag(data.subarray(20,36));return Buffer.concat([decipher.update(data.subarray(36)),decipher.final()]);}
