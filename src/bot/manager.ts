import { Hentadmin } from "../hentadmin";
import { initBotModel, Bot } from "./bot";
import { ErrorLog } from "./errorLog";
import { BotProcessManager } from "./processManager";

export type BotStatus = 'enabled' | 'disabled' | 'enabling' | 'disabling' | 'reloading' | 'failed';
export type BotCtlCommand = 'enable' | 'disable' | 'reload';

export interface BotMessage {
  type: string;
  data?: any;
}

export class BotManager {
  core: Hentadmin;
  errorLog: ErrorLog;
  processManager: BotProcessManager;

  constructor(core: Hentadmin) {
    this.core = core;
    this.errorLog = new ErrorLog(this.core, this);
    this.processManager = new BotProcessManager(this.core, this);
  }

  async init() {
    await this.errorLog.init();
    await initBotModel(this.core);
  }

  async start() {
    const bots = await Bot.findAll();
    await Promise.all(bots.map(v => {
      switch(v.status) {
        case 'enabled':
        case 'enabling':
        case 'reloading':
          this.enableBot(v);
          break;
        case 'disabling':
          this.updateStatus(v, 'disabled');
          break;
        default: break;
      }
    }));
  }

  async updateInfo(bot, groupId) {
    const [ vkInfo ] = await this.core.vk.api.groups.getById({ group_id: groupId, fields: ['members_count'] });
    if (!vkInfo) {
      return;
    }

    bot.info = {
      name: vkInfo.name,
      photos: Object.keys(vkInfo).filter(v => v.startsWith('photo_')).map(v => vkInfo[v]),
      screenName: vkInfo['screen_name'],
      membersCount: vkInfo['members_count'],
      groupId
    };

    bot.save();
    this.core.lolire.server.ws.emitId('info_new', { id: bot.id, info: bot.info }, bot.ownerId);
  }

  updateStatus(bot: Bot, status: BotStatus, autoSave = true) {
    this.core.lolire.log(`${bot.status} > ${status} #${bot.id}`);
    this.core.lolire.server.ws.emitId('status_new', { id: bot.id, status }, bot.ownerId);
    bot.status = status;

    if (autoSave) {
      return bot.save();
    }
  }

  async handleMessage(bot: Bot, msg: BotMessage) {
    await bot.reload();
    if (msg.type === 'nohentadmin') {
      this.core.lolire.server.ws.emitId('nohentadmin', { id: bot.id }, bot.ownerId);
    }

    if (msg.type === 'enabled') {
      this.updateStatus(bot, 'enabled');
      this.updateInfo(bot, msg.data.groupId);
    }
  }

  async onExit(bot: Bot, code: number) {
    await bot.reload();
    if (bot.status === 'reloading') {
      return this.enableBot(bot);
    }

    if (code === 1) {
      return this.updateStatus(bot, 'failed');
    }

    this.updateStatus(bot, 'disabled');
  }

  async enableBot(bot: Bot) {
    await bot.reload();
    this.updateStatus(bot, 'enabling');
    this.processManager.startProcess(bot);
  }

  async disableBot(bot: Bot, reload = false) {
    await bot.reload();
    await this.updateStatus(bot, reload ? 'reloading' : 'disabling');
    this.processManager.stopProcess(bot);
  }

  isAllowed(status: BotStatus, command: BotCtlCommand) {
    const allowed = {
      enabled: ['disable', 'reload'],
      enabling: ['disable'],
      disabled: ['enable'],
      failed: ['enable'],
      disabling: [],
      reloading: ['disable']
    };
  
    return allowed[status].includes(command);
  }

  async ctl(bot: Bot, command: BotCtlCommand, force = false) {
    if (!force) {
      await bot.reload();
      if (!this.isAllowed(bot.status, command)) {
        throw Error('Method not allowed.');
      }
    }

    switch(command) {
      case 'enable':
        this.enableBot(bot);
        break;
      case 'disable':
        this.disableBot(bot);
        break;
      case 'reload':
        this.disableBot(bot, true);
        break;
    }
  }
}