/** Catalog matching suggestions only. Purchase quantities are never stock counts. */
export interface InvoiceCatalogLine { description: string; unit: string; sku?: string; itemId?: string }
export interface InvoiceCatalogGood { id: string; name: string }
export interface InvoiceCatalogOffer { itemId: string; supplierId: string; supplierItemName: string; sku: string }
export interface InvoiceCatalogSuggestion { lineIndex: number; itemId?: string; matchedBy?: 'existing' | 'sku' | 'supplier-name' | 'name'; ambiguous: boolean; create?: { name: string; category: string; baseUnit: string } }
const normalized = (value: string) => value.trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function invoiceCatalogSuggestions(lines: InvoiceCatalogLine[], goods: InvoiceCatalogGood[], offers: InvoiceCatalogOffer[], supplierId?: string): InvoiceCatalogSuggestion[] {
  const known = new Set(goods.map(g => g.id));
  const scoped = supplierId ? offers.filter(o => o.supplierId === supplierId) : [];
  return lines.map((line,lineIndex) => {
    if (line.itemId && known.has(line.itemId)) return {lineIndex,itemId:line.itemId,matchedBy:'existing',ambiguous:false};
    const unique = (ids: string[]) => Array.from(new Set(ids.filter(id => known.has(id))));
    const sku = line.sku?.trim();
    const candidates: { ids: string[]; matchedBy: InvoiceCatalogSuggestion['matchedBy'] }[] = [
      {ids:sku ? unique(scoped.filter(o => o.sku && normalized(o.sku) === normalized(sku)).map(o => o.itemId)) : [],matchedBy:'sku'},
      {ids:unique(scoped.filter(o => normalized(o.supplierItemName) === normalized(line.description)).map(o => o.itemId)),matchedBy:'supplier-name'},
      {ids:unique(goods.filter(g => normalized(g.name) === normalized(line.description)).map(g => g.id)),matchedBy:'name'},
    ];
    for (const candidate of candidates) {
      if (candidate.ids.length > 1) return {lineIndex,ambiguous:true};
      if (candidate.ids.length === 1) return {lineIndex,itemId:candidate.ids[0],matchedBy:candidate.matchedBy,ambiguous:false};
    }
    return {lineIndex,ambiguous:false,create:{name:line.description.trim(),category:'Unsorted goods',baseUnit:line.unit}};
  });
}
