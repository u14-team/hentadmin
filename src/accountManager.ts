import { Hentadmin } from './hentadmin';
import * as Sequelize from 'sequelize';
import * as crypto from 'crypto';
import * as passwordHash from 'password-hash';

export class Account extends Sequelize.Model {
  login: string;
  hashedPassword: string;
}

export class Session extends Sequelize.Model {
  login: string;
  lastUsage: number;
  token: string;
  ip: string;

  isLive(ha: Hentadmin) {
    return Date.now() / 1000 < this.lastUsage + ha.config.sessionLife;
  }

  use(autoSave = true) {
    this.lastUsage = Math.floor(Date.now() / 1000);

    if (autoSave) {
      return this.save();
    }
  }
}

export class AccountManager {
  ha: Hentadmin;

  constructor(ha: Hentadmin) {
    this.ha = ha;
  }

  async init() {
    Account.init({
      login: Sequelize.STRING,
      hashedPassword: Sequelize.STRING,
      rights: Sequelize.ARRAY(Sequelize.STRING),
      values: Sequelize.JSONB
    }, { sequelize: this.ha.db, modelName: 'account' });

    Session.init({
      login: Sequelize.STRING,
      lastUsage: Sequelize.INTEGER,
      token: Sequelize.STRING,
      ip: Sequelize.STRING
    }, { sequelize: this.ha.db, modelName: 'session' });

    await this.ha.db.safeSync(Account);
    await this.ha.db.safeSync(Session);

    this.ha.cmd.addCommand({
      slug: 'adduser',
      description: 'create user',
      handler: this.addUserCommand.bind(this)
    });
  }

  createSession(login, ip) {
    return Session.create({
      lastUsage: Math.floor(Date.now() / 1000),
      token: crypto.randomBytes(16).toString('hex'),
      login,
      ip
    });
  }
  
  async createAccount(login, password) {
    if (await Account.findOne({ where: { login } })) {
      throw Error('A user with this login already exists');
    }

    return Account.create({
      rights: [],
      values: {},
      hashedPassword: passwordHash.generate(password),
      login
    });
  }

  async addUserCommand([_, login, password]) {
    if (!login) {
      throw Error('Use: adduser <login>');
    }

    if (!password) {
      password = crypto.randomBytes(4).toString('hex');
      this.ha.logger.log(`Generated password: ${password}`);
    }

    await this.createAccount(login, password);
    this.ha.logger.log(`Created account: ${login}`);
  }
}