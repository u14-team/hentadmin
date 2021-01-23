import { Lolire } from 'lolire';

import { initApi } from './api';
import { initCli } from './cli';
import { VK } from './vk';
import { BotManager } from './bot/manager';

export class Hentadmin {
  lolire = new Lolire();
  logger = this.lolire.logger;
  vk: VK;
  botManager = new BotManager(this);

  version: string;
  config: any;

  async init() {
    const packageData = await this.lolire.util.loadJson('./package.json');
    this.version = packageData.version;

    try {
      this.logger.info(`Welcome to HentAdmin V${this.version}.`);
      await this.lolire.init({
        config: await this.lolire.util.loadJson('./config.json'),
        core: this,
        initApi,
        initCli
      });

      this.vk = new VK(this);
      await this.vk.init();
      await this.botManager.init();
    } catch (error) {
      this.logger.error(`Hentadmin init: ${error.stack}`);
      process.exit(-1);
    }
  }

  async start() {
    await this.botManager.start();
    await this.lolire.start();
  }
}