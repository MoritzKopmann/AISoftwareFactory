// HTTP DTOs: JSON-serializable shapes for the public API.
export interface OrderLineDto {
  sku: string;
  qty: number;
  unitPrice: number;
}

export interface PlaceOrderRequest {
  userId: string;
  lines: OrderLineDto[];
}

export interface OrderDto {
  id: string;
  userId: string;
  lines: OrderLineDto[];
  total: number;
  createdAt: string; // ISO string on the wire, Date in the domain
}
