import * as Sequelize from 'sequelize';
import { Hentadmin } from '../hentadmin';
import { Bot } from './bot';
import { BotManager } from './manager';

export class ErrorRow extends Sequelize.Model {
  botId: number;
  message: string;
  createdAt: number;
  lastTime: number;
  count: number;
}

export class ErrorLog {
  ha: Hentadmin;

  constructor(ha: Hentadmin, botManager: BotManager) {
    this.ha = ha;
  }

  async init() {
    ErrorRow.init({
      botId: { type: Sequelize.INTEGER, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      createdAt: { type: Sequelize.INTEGER, allowNull: false },
      lastTime: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    }, { sequelize: this.ha.lolire.db, modelName: 'errorRow' });

    await this.ha.lolire.db.safeSync(ErrorRow);
  }

  async registerError(bot: Bot, message: string) {
    bot.hasErrors = true;
    bot.save();

    const row: ErrorRow = await ErrorRow.findOne({ where: { botId: bot.id, message } });
    if (row) {
      row.count++;
      row.lastTime = Math.floor(Date.now() / 1000);
      return row.save();
    }

    return ErrorRow.create({
      botId: bot.id,
      createdAt: Math.floor(Date.now() / 1000),
      message
    });
  }

  getErrors(botId: number) {
    return ErrorRow.findAll({ where: { botId } });
  }

  async removeError(id: number, bot: Bot) {
    if (await ErrorRow.count({ where: { botId: bot.id } }) === 1) {
      bot.hasErrors = false;
      bot.save();
    }

    return ErrorRow.destroy({ where: { botId: bot.id, id } });
  }

  flushErrors(bot: Bot) {
    bot.hasErrors = false;
    bot.save();

    return ErrorRow.destroy({ where: { botId: bot.id } });
  }
}