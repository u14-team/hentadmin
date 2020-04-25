import { Hentadmin } from './hentadmin';
import { Sequelize } from 'sequelize';

export class Db extends Sequelize {
  ha: Hentadmin;

  constructor(ha) {
    super(ha.config.database, { logging: false });
    this.ha = ha;
  }

  async init() {
    try {
      await super.authenticate();
      this.ha.logger.log('Connected to database.');
    } catch (err) {
      throw Error(`Database error: ${err.message}`);
    }
  }

  async safeSync(model) {
    // TODO: REWRITE

    await model.sync();
    const { options } = model;
    const queryInterface = model.QueryInterface;
    const tableName = model.getTableName(options);

    const columns = await queryInterface.describeTable(tableName);

    for (const columnName of Object.keys(model.tableAttributes)) {
      if (columns[columnName]) continue;

      const answer = await this.ha.cmd.questionYN(`Добавить "${columnName}" в таблицу "${tableName}"`);
      if (answer) {
        this.ha.logger.log(`Добавляю "${columnName}" в таблицу "${tableName}"...`);
        await queryInterface.addColumn(tableName, columnName, model.tableAttributes[columnName]);
      } else {
        this.ha.logger.log('Пропускаю...');
      }
    }

    for (const columnName of Object.keys(columns)) {
      if (model.tableAttributes[columnName]) continue;

      const answer = await this.ha.cmd.questionYN(`Удалить "${columnName}" из таблицы "${tableName}"`);
      if (answer) {
        this.ha.logger.log(`Удаляю "${columnName}" из таблицы "${tableName}"...`);
        await queryInterface.removeColumn(tableName, columnName, options);
      } else {
        this.ha.logger.log('Пропускаю...');
      }
    }
  }
}
