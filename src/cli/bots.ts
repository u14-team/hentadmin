import { Cmd, CmdContext } from 'lolire';
import { Bot } from '../bot/bot';

export function initBotsCli(cmd: Cmd) {
  cmd.on({
    name: 'bots',
    description: 'list all bots',
    handler: async (ctx: CmdContext) => {
      const bots = await Bot.findAll();
      const botsLines = bots
        .map(v => v.toJSON())
        .map(({ info, ownerId, status }) =>
          `● ${info.name} (${ownerId}) - ${status}`
        );

      ctx.lolire.log(`All bots:\n${botsLines.join('\n')}`)
    }
  });

  cmd.on({
    name: 'addbot <path:word> <ownerId:int>',
    handler: async (ctx: CmdContext) => {
      const { path, ownerId } = ctx.params;
      if (await Bot.findOne({ where: { path } })) {
          throw Error('Bot is exists');
        }

        const bot = await Bot.create({ path: path, ownerId: ownerId || 0 });
        ctx.lolire.logger.log(`New bot #${bot.id}`);
    }
  });

  cmd.on({
    name: 'chown <botId:int> <ownerId:int>',
    handler: async (ctx: CmdContext) => {
      const { botId, ownerId } = ctx.params;
      const bot = await Bot.findOne({ where: { id: botId } });
      if (!bot) {
        throw Error('Bot not exists');
      }

      bot.ownerId = ownerId;
      bot.save();
      ctx.lolire.logger.log(`Bot #${bot.id} owner changed.`);
    }
  });

  cmd.on({
    name: 'remove <botId:int>',
    handler: async (ctx: CmdContext) => {
      const { botId } = ctx.params;
      const bot = await Bot.findOne({ where: { id: botId } });
      if (!bot) {
        throw Error('Bot not exists');
      }

      bot.destroy();
      ctx.lolire.logger.log(`Bot #${bot.id} removed.`);
    }
  });
}
