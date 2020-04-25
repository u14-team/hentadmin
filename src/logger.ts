import * as chalk from 'chalk';

export class Logger {
  logFormat: string = chalk`{green [LOG]} `;
  warningFormat: string = chalk`{yellow [WRN]} - {yellow ⚠} `;
  errorFormat: string = chalk`{red [ERR]} - {red ❗} `;
  infoFormat: string = chalk`{blue [INF]} `;

  writeLine(str: string) {
    process.stdout.write(`${str}\n`);
  }

  log(message: string) {
    this.writeLine(this.logFormat + message);
  }

  warning(message: string) {
    this.writeLine(this.warningFormat + message);
  }

  error(message: string) {
    this.writeLine(this.errorFormat + message);
  }

  info(message: string) {
    this.writeLine(this.infoFormat + message);
  }
}
