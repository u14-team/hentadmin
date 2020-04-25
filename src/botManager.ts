import { Hentadmin } from './hentadmin';
import * as childProcess from 'child_process';
import * as Sequelize from 'sequelize';

export interface BotInfo {
  groupId: number;
  name: string;
  photos: string[];
  screenName: string;
  membersCount:
  number;
}

export class Bot extends Sequelize.Model {
  id: number;
  path: string;
  ownerId: number;
  members: number[];
  status: string;
  info?: BotInfo
}

export interface BotInstance { botId: number; process: childProcess.ChildProcess; startAt: number; }
export class BotManager {
  ha: Hentadmin;
  botInstances = new Map<number, BotInstance>();

  constructor(ha: Hentadmin) {
    this.ha = ha;
  }

  async init() {
    Bot.init({
      path: { type: Sequelize.STRING, allowNull: false },
      ownerId: { type: Sequelize.INTEGER, allowNull: false },
      members: { type: Sequelize.ARRAY(Sequelize.INTEGER), allowNull: false, defaultValue: [] },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'disabled' },
      info: Sequelize.JSON
    }, { sequelize: this.ha.db, modelName: 'bot' });

    // await Bot.sync({ force: true });
    await this.ha.db.safeSync(Bot);

    this.ha.cmd.addCommand({
      slug: 'botctl',
      description: 'ctl system',
      handler: async ([_, command, botId]) => {
        const bot: Bot = await Bot.findOne({ where: { id: botId } });
        if (!bot) {
          throw Error('Bot not found');
        }

        const allowed = {
          enabled: ['disable', 'reload'],
          enabling: ['disable'],
          disabled: ['enable'],
          failed: ['enable'],
          disabling: [],
          reloading: ['disable']
        };
      
        if (!allowed[bot.status].includes(command)) {
          throw Error('Method not allowed');
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
    });

    this.ha.cmd.addCommand({
      slug: 'addbotpath',
      description: 'Add a bot from path',
      handler: async ([_, ownerId, path]) => {
        if (await Bot.findOne({ where: { path } })) {
          throw Error('Bot is exists');
        }

        const bot = await Bot.create({ path: path, ownerId });
        this.ha.logger.log(`New bot #${bot.id}`);
      }
    });

    this.ha.cmd.addCommand({
      slug: 'removebot',
      description: 'Remove bot',
      handler: async ([_, id]) => {
        const bot = await Bot.findOne({ where: { id } });
        if (!bot) {
          throw Error('Bot not found');
        }

        if (bot.status !== 'disabled') {
          throw Error('Disable bot');
        }

        if (!await this.ha.cmd.questionYN(`Remove bot #${bot.id} (${bot.path}) from HentAdmin`)) {
          return;
        }

        bot.destroy();
        this.ha.logger.log(`Removed bot #${bot.id}`);
      }
    });

    this.ha.cmd.addCommand({
      slug: 'bots',
      description: 'List bots',
      handler: async () => {
        const bots = await Bot.findAll();
        bots.forEach(({ id, ownerId, path }) => {
          this.ha.logger.log(`● ${path} #${id} (${ownerId})`);
        });
      }
    });
  }

  async start() {
    /*await Bot.create({
      path: 'testbot',
      ownerId: 1,
      members: [],
      enabled: true
    })*/
    const bots = await Bot.findAll();
    await Promise.all(bots.map(v => {
      switch(v.status) {
        case 'enabled':
        case 'enabling':
        case 'reloading':
          this.enableBot(v);
          break;
        case 'disabled':
        case 'failed':
          break;
        case 'disabling':
          this.updateStatus(v, 'disabled');
          break;
      }
    }));
  }

  async updateInfo(bot, groupId) {
    const [ vkInfo ] = await this.ha.vk.api.groups.getById({ group_id: groupId, fields: ['members_count'] });
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
    this.ha.server.ws.emitId('info_new', { id: bot.id, info: bot.info }, bot.ownerId);
  }

  getInstance(botId: number) {
    return this.botInstances.get(botId);
  }

  updateStatus(bot, status, autoSave = true) {
    this.ha.logger.log(`${bot.status} > ${status} ${bot.id} (${bot.path})`);
    bot.status = status;
    this.ha.server.ws.emitId('status_new', { id: bot.id, status }, bot.ownerId);
    if (autoSave) {
      return bot.save();
    }
  }

  async enableBot(bot: Bot) {
    await bot.reload();
    if (this.botInstances.get(bot.id)) {
      throw Error('Бот уже запущен');
    }

    this.updateStatus(bot, 'enabling');
    try {
      const cp = childProcess.fork(`start.js`, [], {
        cwd: `${this.ha.config.botsDir}/${bot.path}`,
        detached: false,
        silent: true
      });

      cp.stdout.on('data', chunk => {
        this.ha.server.ws.emitState('console', chunk.toString(), `console:${bot.id}`);
      });
      
      cp.stderr.on('data', chunk => {
        this.ha.server.ws.emitState('console', chunk.toString(), `console:${bot.id}`);
        this.ha.server.ws.emitId('bot_error', { id: bot.id, error: chunk.toString() }, bot.ownerId);
      });

      cp.on('message', msg => this.handleMessage(bot, JSON.parse(msg.toString())));
      cp.on('close', async code => {
        await bot.reload();
        if (bot.status === 'reloading') {
          return this.enableBot(bot);
        }

        if (code === 1) {
          return this.updateStatus(bot, 'failed');
        }

        this.updateStatus(bot, 'disabled');
      });

      this.botInstances.set(bot.id, {
        botId: bot.id,
        process: cp,
        startAt: Date.now()
      } as BotInstance);
    } catch(error) {
      this.ha.server.ws.emitId('error', { id: bot.id, error: error.message }, bot.ownerId);
      this.updateStatus(bot, 'failed');
    }
  }

  async disableBot(bot: Bot, reload = false) {
    await bot.reload();
    const botInstance = this.botInstances.get(bot.id);
    if (!botInstance) {
      throw Error('Бот не запущен');
    }

    await this.updateStatus(bot, reload ? 'reloading' : 'disabling');
    botInstance.process.kill();
    this.botInstances.delete(bot.id);
  }

  async handleMessage(bot: Bot, msg: any) {
    await bot.reload();
    if (msg.type === 'nohentadmin') {
      this.ha.server.ws.emitId('nohentadmin', { id: bot.id }, bot.ownerId);
    }

    if (msg.type === 'enabled') {
      this.updateStatus(bot, 'enabled');
      this.updateInfo(bot, msg.groupId);
    }
  }
}