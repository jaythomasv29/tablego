export type InvoiceSuggestion = { description: string; quantity?: number; unit?: string; supplierCode?: string; unitPrice?: number; lineTotal?: number };
export const MAX_INVOICE_BYTES = 3 * 1024 * 1024;
export function validateInvoiceFile(bytes: Uint8Array, declaredType: string) {
  if (!bytes.length || bytes.length > MAX_INVOICE_BYTES) throw new Error('Choose an invoice up to 3 MB.');
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const ascii = (offset: number, value: string) => Array.from(value).every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  const type = starts(0xff, 0xd8, 0xff) ? 'image/jpeg' : starts(137,80,78,71,13,10,26,10) ? 'image/png' : ascii(0,'RIFF') && ascii(8,'WEBP') ? 'image/webp' : ascii(0,'%PDF-') ? 'application/pdf' : '';
  if (!type || declaredType !== type) throw new Error('Choose a valid JPEG, PNG, WebP photo or PDF invoice.');
  return type;
}
export function invoiceFilename(name: string) { return name.replace(new RegExp('[^\\p{L}\\p{N} ._()-]', 'gu'), '_').slice(0,100) || 'invoice'; }
// Deliberately conservative: OCR output is a suggestion, never a stock mutation.
export function extractInvoiceLines(text: string): InvoiceSuggestion[] {
  return text.slice(0,50000).split(/\r?\n/).map(line => line.trim().replace(/\s+/g,' ')).filter(line => line.length >= 3 && /[a-zA-Z]/.test(line) && !/^(subtotal|total|grand total|tax|balance|amount due|invoice|date|ship to|bill to|page|payment|thank you)\b/i.test(line)).slice(0,150).map(description => {
    const result: InvoiceSuggestion = { description };
    const match = description.match(/^(\d+(?:\.\d{1,2})?)\s+(case|cs|box|bag|lb|lbs|oz|each|ea|can|pack|bottle|bunch|gallon)\b\s+(.+)/i);
    if (match) { result.quantity = Number(match[1]); result.unit = ({ cs: 'case', ea: 'each', lbs: 'lb' } as Record<string,string>)[match[2].toLowerCase()] || match[2].toLowerCase(); result.description = match[3]; }
    // Only currency-marked terminal values are price suggestions; product codes
    // and bare numeric labels remain untouched for review.
    const money = result.description.match(/\s+\$([\d,]+\.\d{2})(?:\s+\$([\d,]+\.\d{2}))?$/);
    if (money) {
      const first = Number(money[1].replace(/,/g,'')), second = money[2] ? Number(money[2].replace(/,/g,'')) : undefined;
      if(Number.isFinite(first) && first <= 99999999 && (second === undefined || Number.isFinite(second) && second <= 99999999)) {
        result.description = result.description.slice(0,money.index).trim();
        if(second !== undefined) { result.unitPrice = first; result.lineTotal = second; } else result.lineTotal = first;
      }
    }
    return result;
  });
}

export type InvoiceHeaderSuggestion = { number?:string; date?:string; total?:number };
export function extractInvoiceHeader(text:string):InvoiceHeaderSuggestion {
 const result:InvoiceHeaderSuggestion={};
 for(const raw of text.slice(0,50000).split(/\r?\n/)){const line=raw.trim();
 const number=line.match(/^invoice\s*(?:number|no\.?|#)\s*[:#]?\s*([a-z0-9][a-z0-9_\/-]{0,79})$/i);if(number&&!result.number)result.number=number[1];
 const date=line.match(/^(?:invoice\s+)?date\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/i);
 if(date&&!result.date){const parts=date[1].split('/'),iso=parts.length===3?`${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`:date[1];const parsed=new Date(`${iso}T12:00:00Z`);if(!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso)result.date=iso;}
 const total=line.match(/^(?:grand\s+total|invoice\s+total|total|amount\s+due)\s*:?\s*\$([\d,]+\.\d{2})$/i);if(total){const amount=Number(total[1].replace(/,/g,''));if(Number.isFinite(amount)&&amount<=99999999)result.total=amount;}
 }return result;
}
