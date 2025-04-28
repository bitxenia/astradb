import { AstraDb } from "./index.js";

export class AstraDbNode implements AstraDb {
  public async add(key: string, value: string): Promise<void> {
    return;
  }

  public async get(key: string): Promise<string> {
    return;
  }
}
