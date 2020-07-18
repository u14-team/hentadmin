import * as Sequelize from 'sequelize';
import { BotStatus } from './manager';

export interface BotInfo {
  groupId: number;
  name: string;
  photos: string[];
  screenName: string;
  membersCount: number;
  unknown?: boolean;
}

export class Bot extends Sequelize.Model {
  id: number;
  path: string;
  ownerId: number;
  members: number[];
  status: BotStatus;
  info: BotInfo;
  hasErrors: boolean;

  toJSON() {
    return {
      id: this.id,
      path: this.path,
      ownerId: this.ownerId,
      status: this.status,
      info: this.info || { name: `Bot #${this.id}`, unknown: true },
      hasErrors: this.hasErrors
    };
  }
}

export async function initBotModel(ha) {
  Bot.init({
    path: { type: Sequelize.STRING, allowNull: false },
    ownerId: { type: Sequelize.INTEGER, allowNull: false },
    members: { type: Sequelize.ARRAY(Sequelize.INTEGER), allowNull: false, defaultValue: [] },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'disabled' },
    info: Sequelize.JSON,
    hasErrors: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  }, { sequelize: ha.lolire.db, modelName: 'bot' });

  await ha.lolire.db.safeSync(Bot);
}