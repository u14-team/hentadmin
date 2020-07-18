import { Hentadmin } from "../hentadmin";
import { fork, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { Bot } from "./bot";
import { BotManager } from "./manager";

export interface BotProcess {
  botId: number;
  process: ChildProcess;
  startAt: number;
  logFile: fs.WriteStream;
}

export class BotProcessManager {
  core: Hentadmin;
  botManager: BotManager;

  processes = new Map<number, BotProcess>();

  constructor(core: Hentadmin, botManager: BotManager) {
    this.core = core;
    this.botManager = botManager;

    this.core.lolire.onShutdown(() => {
      this.core.lolire.log(`Closing ${this.processes.size} bot processes.`);
      this.processes.forEach(v => v.process.kill('SIGTERM'));
    });
  }

  writeIn(botId: number, str: string) {
    const { process } = this.getProcess(botId);
    process.stdin.write(str);
  }

  sendHa(botId: number, data) {
    const { process } = this.getProcess(botId);
    return new Promise((resolve, reject) => {
      const random = Math.random().toString();
      process.once('message', msg => {
        const body = JSON.parse(msg.toString());
        if (body.random !== random) {
          return;
        }

        if (body.type === 'messageResponse:error') {
          reject(body.data);
        }

        if (body.type === 'messageResponse') {
          resolve(body.data);
        }
      });

      process.send(JSON.stringify({ ...data, random }));
    });
  }

  getProcess(id: number): BotProcess {
    return this.processes.get(id);
  }

  onData(bot: Bot, chunk: string, isError = false) {
    const process = this.getProcess(bot.id);
    process.logFile.write(chunk);
    this.core.lolire.server.ws.emitState('console', chunk, `console:${process.botId}`);
  
    if (isError) {
      if (chunk.includes('Warning: require() of ES modules is not supported.')) {
        return; // Ignore ES-Deprecated warning
      }

      if (chunk.includes('UnhandledPromiseRejectionWarning: FetchError: network timeout at: https://pu.vk.com')) {
        return; // Ignore vk timeout warnings
      }

      this.core.lolire.warning(`Bot ${bot.info.name} has errors!`);
      this.core.lolire.server.ws.emitId('bot_error', { id: bot.id, error: chunk }, bot.ownerId);
      this.core.botManager.errorLog.registerError(bot, chunk);
    }
  }

  onClose(bot: Bot, code: number) {
    const process = this.getProcess(bot.id);
    process.logFile.write(`Bot exited. (${code})`);
    process.logFile.close();
    this.processes.delete(bot.id);

    if (this.core.lolire.isShutdown) {
      return;
    }

    this.botManager.onExit(bot, code);
  }

  startProcess(bot: Bot) {
    try {
      const logFile = fs.createWriteStream(`logs/${bot.id}.log`);
      const cp = fork(`start.js`, ['--color'], {
        cwd: `${this.core.lolire.config.botsDir}/${bot.path}`,
        detached: false,
        silent: true
      });

      cp.stdout.on('data', chunk => this.onData(bot, chunk.toString()));
      cp.stderr.on('data', chunk => this.onData(bot, chunk.toString(), true));

      cp.on('message', msg => this.botManager.handleMessage(bot, JSON.parse(msg.toString())));
      cp.on('close', async code => this.onClose(bot, code));

      this.processes.set(bot.id, {
        botId: bot.id,
        process: cp,
        startAt: Math.floor(Date.now() / 1000),
        logFile
      });
    } catch(error) {
      this.onData(bot, error.stack, true);
      this.botManager.updateStatus(bot, 'failed');
    }
  }

  stopProcess(bot: Bot) {
    const process = this.getProcess(bot.id);
    if (!process) {
      return false;
    }

    process.process.kill('SIGINT');
    return true;
  }
}