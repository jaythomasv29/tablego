import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceCatalogSuggestions } from '../src/lib/inventory/invoiceCatalog.ts';
const goods=[{id:'basil',name:'Basil'},{id:'thai-basil',name:'Thai Basil'},{id:'duplicate',name:'Basil'}];
const offers=[{itemId:'basil',supplierId:'a',sku:'B01',supplierItemName:'BASIL 4LB'},{itemId:'thai-basil',supplierId:'b',sku:'B01',supplierItemName:'BASIL 4LB'}];
test('invoice catalog suggestions scope supplier SKUs and exact supplier names',()=>{
 assert.equal(invoiceCatalogSuggestions([{description:'Unrecognized name',sku:'b01',unit:'case'}],goods,offers,'a')[0].itemId,'basil');
 assert.equal(invoiceCatalogSuggestions([{description:' basil  4LB ',unit:'case'}],goods,offers,'b')[0].itemId,'thai-basil');
 assert.equal(invoiceCatalogSuggestions([{description:'Unrecognized name',sku:'B01',unit:'case'}],goods,offers)[0].itemId,undefined);
});
test('ambiguous catalog names require explicit selection and never create duplicates automatically',()=>{
 const suggestion=invoiceCatalogSuggestions([{description:'Basil',unit:'lb'}],goods,offers,'a')[0];
 assert.equal(suggestion.ambiguous,true); assert.equal(suggestion.itemId,undefined); assert.equal(suggestion.create,undefined);
});
test('unknown invoice item offers explicit catalog draft without any on-hand quantity',()=>{
 const suggestion=invoiceCatalogSuggestions([{description:'Baby corn',unit:'can',quantity:12}],goods,offers,'a')[0];
 assert.deepEqual(suggestion.create,{name:'Baby corn',category:'Unsorted goods',baseUnit:'can'});
 assert.equal(JSON.stringify(suggestion).includes('quantity'),false);
});
test('explicit existing link stays selected while stale IDs do not silently match',()=>{
 assert.equal(invoiceCatalogSuggestions([{description:'Basil',unit:'lb',itemId:'thai-basil'}],goods,offers,'a')[0].matchedBy,'existing');
 assert.equal(invoiceCatalogSuggestions([{description:'Unknown',unit:'lb',itemId:'deleted'}],goods,offers,'a')[0].itemId,undefined);
});
