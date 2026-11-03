import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyStockBoard, dailyStockSummary} from '../src/lib/inventory/dailyStock.ts';
import {issueSignedToken, verifySignedToken} from '../src/lib/auth/signedToken.ts';
const goods = [{id:'melon',name:'Melon',category:'Produce',baseUnit:'each'}, {id:'basil',name:'Basil',category:'Produce',baseUnit:'lb'}, {id:'rice',name:'Rice',category:'Pantry',baseUnit:'bag'}];
const stock = {
 basil:{quantity:4,unit:'lb',checkedAt:'2026-11-02T19:00:00Z',countedAt:'2026-11-01T19:00:00Z',checkedOn:'2026-11-02',decision:'sufficient',checkedBy:'PRIVATE STAFF',version:2},
 rice:{quantity:0,unit:'bag',checkedAt:'2026-11-01T19:00:00Z',checkedOn:'2026-11-01',decision:'order',orderOpen:true},
};
const make = data => dailyStockBoard(goods, data ?? stock, '2026-11-02', 'America/Los_Angeles', '2026-11-02T19:05:00Z');
test('daily stock includes never-counted goods, categories, physical amounts and separate check/count times', () => {
 const board=make(); assert.equal(board.rows.length,3);
 const melon=board.rows.find(r=>r.id==='melon'); assert.equal(melon.quantity,null);assert.equal(melon.checkedAt,null);assert.equal(melon.state,'unchecked');
 const basil=board.rows.find(r=>r.id==='basil');assert.equal(basil.state,'checked');assert.notEqual(basil.checkedAt,basil.countedAt);assert.equal(basil.quantity,4);
 assert.deepEqual(dailyStockSummary(board),{total:3,reviewed:1,remaining:2,out:1});
 assert.equal(board.rows.find(r=>r.id==='rice').state,'out');
 assert.equal(JSON.stringify(board).includes('PRIVATE STAFF'),false);
 assert.deepEqual(Object.keys(basil).sort(),['id','name','detail','category','location','quantity','unit','checkedAt','countedAt','reviewedToday','orderOpen','state'].sort());
});
test('a new restaurant day clears reviewed status without fabricating new physical stock', () => {
 const board=dailyStockBoard(goods,stock,'2026-11-03','America/Los_Angeles');
 assert.equal(dailyStockSummary(board).reviewed,0);assert.equal(board.rows.find(r=>r.id==='basil').state,'due');assert.equal(board.rows.find(r=>r.id==='basil').quantity,4);
});
test('legacy receiving estimates never appear as physical stock', () => {
 const board=make({melon:{quantity:20,unit:'case',stockSource:'receipt',lastCountQuantity:2,lastCountUnit:'each',countedAt:'2026-10-31T18:00:00Z'},rice:{quantity:10,unit:'bag',stockSource:'receipt'}});
 assert.equal(board.rows.find(r=>r.id==='melon').quantity,2);assert.equal(board.rows.find(r=>r.id==='melon').unit,'each');
 assert.equal(board.rows.find(r=>r.id==='rice').quantity,null);assert.equal(board.rows.find(r=>r.id==='rice').countedAt,null);
});
test('inventory links expire after seven days and cannot authenticate staff or phone proofs', async () => {
 const secret='daily-stock-test-secret-at-least-32-characters',now=Date.parse('2026-11-02T19:00:00Z');
 const {token}=await issueSignedToken('inventory-view',{scope:'daily-stock'},7*86400,secret,now);
 assert.ok(await verifySignedToken(token,'inventory-view',secret,now+7*86400000-1000));
 assert.equal(await verifySignedToken(token,'inventory-view',secret,now+7*86400000),null);
 assert.equal(await verifySignedToken(token,'admin',secret,now),null);assert.equal(await verifySignedToken(token,'phone',secret,now),null);
 const [claims,signature]=token.split('.');assert.equal(await verifySignedToken(`${claims}x.${signature}`,'inventory-view',secret,now),null);
});
