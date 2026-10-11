export type StopActionDescription = {
  readonly label: string;
  readonly pressable: boolean;
  readonly announcement?: string;
};

export function describeStopAction(stopping: boolean): StopActionDescription {
  return stopping
    ? { label: 'Stopping…', pressable: false, announcement: 'Stopping the run' }
    : { label: 'Stop', pressable: true };
}
