import { promises as fs } from 'fs';

import { Logger } from './logger';
import { Util } from './util';
import { Api } from './api/api';
import { Cmd } from './cmd';
import { Server } from './server';
import { Db } from './db';
import { AccountManager } from './accountManager';
import { VK } from './vk';
import { BotManager } from './botManager';

export class Hentadmin {
  logger = new Logger();
  util = new Util();
  api = new Api(this);
  cmd = new Cmd(this);
  server = new Server(this);
  db: Db;
  accountManager = new AccountManager(this);
  vk = new VK(this);
  botManager = new BotManager(this);

  version: string;
  config: any;

  async init() {
    const packageData = await this.util.loadJson('./package.json');
    this.version = packageData.version;

    try {
      this.logger.info(`Welcome to HentAdmin V${this.version}.`);
      this.api.init();

      this.config = JSON.parse((await fs.readFile('./config.json')).toString());
      await this.vk.init();
      this.db = new Db(this);
      await this.db.init();

      await this.accountManager.init();
      await this.botManager.init();

    } catch (error) {
      this.logger.error(`Hentadmin init: ${error.stack}`);
      process.exit(-1);
    }
  }

  async start() {
    await this.botManager.start();
    await this.server.start();
  }
}