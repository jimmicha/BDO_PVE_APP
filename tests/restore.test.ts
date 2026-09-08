import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {randomBytes,randomUUID} from 'node:crypto';
// @ts-expect-error Shared Node harness.
import {openDatabase,seedUsers,rpc,ALICE,BOB} from '../scripts/database.mjs';
// @ts-expect-error Shared Node operation helper.
import {encrypt,decrypt} from '../scripts/backup-crypto.mjs';
it('restores encrypted PostgreSQL data and reapplies account deletions made after the snapshot',async()=>{
  const db=await openDatabase();let restored:PGlite|undefined;
  try{
    await seedUsers(db);
    for(const id of [ALICE,BOB]){const s=await rpc(db,id,'companion_snapshot');await rpc(db,id,'companion_command',{kind:'family_create',data:{family_name:id===ALICE?'Keep me':'Delete me',region:'EU'},request_id:randomUUID(),expected_revision:s.profile.revision});}
    const key=randomBytes(32).toString('hex'),dump=await db.dumpDataDir(),encrypted=encrypt(Buffer.from(await dump.arrayBuffer()),key);
    await rpc(db,BOB,'companion_request_deletion');const ledger=(await db.query('select user_id,requested_at from app_private.deletion_requests')).rows;
    restored=new PGlite({loadDataDir:new Blob([decrypt(encrypted,key)])});
    expect((await rpc(restored,BOB,'companion_snapshot')).game_profiles[0].family_name).toBe('Delete me');
    await restored.transaction(async tx=>{for(const item of ledger){await tx.query('insert into app_private.deletion_requests(user_id,requested_at,completed_at) values($1,$2,now()) on conflict do nothing',[item.user_id,item.requested_at]);await tx.query('delete from auth.users where id=$1',[item.user_id]);}});
    await expect(rpc(restored,BOB,'companion_snapshot')).rejects.toThrow('ACCOUNT_DELETING');
    expect((await rpc(restored,ALICE,'companion_snapshot')).game_profiles[0].family_name).toBe('Keep me');
    expect((await restored.query('select * from app_private.game_profiles where owner_id=$1',[BOB])).rows).toHaveLength(0);
  }finally{await restored?.close();await db.close();}
},30000);
