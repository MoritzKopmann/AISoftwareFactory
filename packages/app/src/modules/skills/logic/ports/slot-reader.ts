export type SlotReader = {
  readonly read: (checkoutPath: string, slotName: string) => Promise<string | undefined>;
};
