export interface Edi850PurchaseOrder {
  poNumber: string;
  poDate: string;
  orderType: "SA" | "RL" | "NE";
  shipTo: Address;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  lineNumber: number;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  productId: string;
}

export interface Address {
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export function validate(po: Partial<Edi850PurchaseOrder>): string[] {
  const errors: string[] = [];
  if (!po.poNumber) errors.push("BEG02: missing PO number");
  if (!po.lines?.length) errors.push("PO1: no line items found");
  po.lines?.forEach((l, i) => {
    if (!l.productId) errors.push(`PO1 loop ${i + 1}: missing product ID`);
  });
  return errors;
}
