import * as readline from 'readline';
import { Hentadmin } from './hentadmin';

export class Cmd {
  commands = {};
  ha: Hentadmin;
  rl: readline.ReadLine;

  constructor(ha) {
    this.ha = ha;

    this.addDefaultCommands();

    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.on('line', input => this.doCommandline(input));
  }

  addDefaultCommands() {
    // Стандартные команды
    this.addCommand({
      slug: 'help',
      description: 'вывести список команд',
      handler: () => {
        this.ha.logger.log('Список доступных команд:');
        Object.values(this.commands).forEach(({ slug, usage, description }) => {
          this.ha.logger.log(`● ${slug}${usage ? ` ${usage}` : ''} - ${description}`);
        });
      }
    });

    this.addCommand({
      slug: 'exit',
      description: 'закрыть HENTA',
      handler: () => {
        process.kill(process.pid, 'SIGINT');
      }
    });
  }

  question(str) {
    return new Promise(resolve => this.rl.question(str, resolve));
  }

  async questionYN(str) {
    const response = await this.question(`${str}? [y/n] `);
    return response === 'y';
  }

  doCommandline(input) {
    const args = input.trim().split(' ');
    if (!args[0]) {
      return;
    }

    const command = this.commands[args[0]];
    if (!command) {
      this.ha.logger.log(`Команда '${args[0]}' не найдена.`);
      this.ha.logger.log('Введите \'help\' для просмотра списка команд.');
      return;
    }

    return command.handler(args);
  }

  addCommand(command) {
    this.commands[command.slug] = command;
  }
}