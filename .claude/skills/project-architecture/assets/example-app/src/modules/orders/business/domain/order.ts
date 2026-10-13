// ENTITIES.
export interface OrderLine {
  sku: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  lines: OrderLine[];
  total: number;
  createdAt: Date;
}
