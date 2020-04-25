import { promises as fs } from 'fs';

export class Util {
  async loadJson(filePath: string) {
    return JSON.parse((await fs.readFile(filePath)).toString());
  }
}