import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInvoiceHeader, extractInvoiceLines, invoiceFilename, validateInvoiceFile, MAX_INVOICE_BYTES } from '../src/lib/inventory/invoiceExtraction.ts';
test('invoice suggestions only infer explicit quantities with units, never prices as counts', () => {
 const lines = extractInvoiceLines('Invoice 1022\n2 case Chicken breast\nBasil 18.99\nTotal 100.00\nTax 8.00');
 assert.deepEqual(lines,[{description:'Chicken breast',quantity:2,unit:'case'},{description:'Basil 18.99'}]);
 assert.equal(extractInvoiceLines('10 Chicken breast $35.00')[0].quantity,undefined);
});
test('invoice upload validates magic bytes, size, and declared MIME', () => {
 assert.equal(validateInvoiceFile(Uint8Array.from([255,216,255,224]),'image/jpeg'),'image/jpeg');
 assert.equal(validateInvoiceFile(new TextEncoder().encode('%PDF-1.7'),'application/pdf'),'application/pdf');
 assert.throws(() => validateInvoiceFile(new TextEncoder().encode('<script>bad</script>'),'image/jpeg'),/valid JPEG/);
 assert.throws(() => validateInvoiceFile(Uint8Array.from([255,216,255]),'application/pdf'),/valid JPEG/);
 assert.throws(() => validateInvoiceFile(new Uint8Array(MAX_INVOICE_BYTES+1),'image/jpeg'),/3 MB/);
 assert.throws(() => validateInvoiceFile(new Uint8Array(),'image/jpeg'),/3 MB/);
});
test('invoice filenames strip path, markup, controls and excessive length', () => {
 assert.equal(invoiceFilename('../../<bad>\n.pdf'),'.._..__bad__.pdf');
 assert.equal(invoiceFilename('x'.repeat(300)).length,100);
});
test('photo signature checks reject PNG and WebP MIME spoofing', () => {
 assert.equal(validateInvoiceFile(Uint8Array.from([137,80,78,71,13,10,26,10]),'image/png'),'image/png');
 assert.equal(validateInvoiceFile(new TextEncoder().encode('RIFF0000WEBP'),'image/webp'),'image/webp');
 assert.throws(() => validateInvoiceFile(new TextEncoder().encode('RIFF0000WAVE'),'image/webp'),/valid JPEG/);
});
test('OCR draft limits prevent runaway line counts and never infer supplier codes or money', () => {
 const lines = extractInvoiceLines(Array(300).fill('001234 Basil 3.50 7.00').join('\n'));
 assert.equal(lines.length,150);
 assert.equal(lines[0].supplierCode,undefined); assert.equal(lines[0].lineTotal,undefined); assert.equal(lines[0].quantity,undefined);
});

test('OCR only suggests currency-marked terminal prices and labeled invoice headers',()=>{assert.deepEqual(extractInvoiceLines('2 case Basil $10.25 $20.50'),[{description:'Basil',quantity:2,unit:'case',unitPrice:10.25,lineTotal:20.50}]);assert.deepEqual(extractInvoiceLines('Basil $18.99'),[{description:'Basil',lineTotal:18.99}]);assert.deepEqual(extractInvoiceHeader('Invoice # ABC-22\nInvoice date: 10/28/2026\nSubtotal $100.00\nTax $8.00\nTotal: $108.00'),{number:'ABC-22',date:'2026-10-28',total:108});assert.deepEqual(extractInvoiceHeader('Date: 02/30/2026\nChicken 120.00\nSubtotal $10.00'),{});});
