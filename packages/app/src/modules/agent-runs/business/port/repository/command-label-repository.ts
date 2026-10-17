export interface CommandLabelRepository {
  findByCommandHash(commandHash: string): Promise<string | undefined>;
  /** A second insert of the same hash is ignored. */
  insert(commandHash: string, label: string): Promise<void>;
}
