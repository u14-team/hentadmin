import { Bot } from '../bot/bot';
import { ApiError } from 'lolire';
import { ApiContext } from 'lolire';
import { promises as fs } from 'fs';
import { ErrorRow } from '../bot/errorLog';
import { initBotsApiTypes } from './resolvers/bots'
import { BotManager } from '../bot/manager';

export default function initApi(api) {
  initBotsApiTypes(api);

  // List bots
  api.on({
    slug: 'bots',
    requirements: 'account',
    handler: async (ctx: ApiContext) => {
      const bots = await Bot.findAll({ where: { ownerId: ctx.data.account.id } });
      ctx.answer(bots.map(v => v.toJSON()));
    }
  });

  // Get bot from id
  api.on({
    slug: 'bots.get',
    requirements: 'account <p:id@bot:.',
    handler: async (ctx: ApiContext) => {
      ctx.answer(ctx.data.bot.toJSON());
    }
  });
  
  // Execute bot command
  api.on({
    slug: 'bots.command',
    requirements: 'account <p:id@bot:. p:command',
    handler: async (ctx: ApiContext) => {
      if (!['enabled', 'enabling'].includes(ctx.data.bot.status)) {
        throw ApiError('invalid_data', {
          type: 'status',
          expected: ['enabled', 'enabling'],
          real: ctx.data.bot.status
        });
      }
      
      const { processManager } = ctx.lolire.core.botManager;
      processManager.writeIn(ctx.data.bot.id, `${ctx.data.command}\n`);
      ctx.answer('ok');
    }
  });

  // Execute ctl on
  api.on({
    slug: 'bots.ctl',
    requirements: 'account <p:id@bot:. p:command',
    handler: async (ctx: ApiContext) => {
      const botManager: BotManager = ctx.lolire.core.botManager;
      try {
        botManager.ctl(ctx.data.bot, ctx.data.command);
        ctx.answer('ok');
      } catch (error) {
        if (error.message === 'on not allowed') {
          throw ApiError('invalid_state', {
            command: ctx.data.command,
            botId: ctx.data.bot.id
          });
        }
        
        throw error;
      }
    }
  });

  // Get log from bot
  api.on({
    slug: 'bots.getLog',
    requirements: 'account <p:id@bot:. p:count',
    handler: async (ctx: ApiContext) => {
      const logData = await fs.readFile(`logs/${ctx.data.bot.id}.log`);
      if (!logData) {
        ctx.answer(['']);
      }
      
      const lines = logData.toString().split('\n');
      ctx.answer(lines.splice(-parseInt(ctx.data.count)));
    }
  });

  // Get bot errors
  api.on({
    slug: 'bots.getErrors',
    requirements: 'account <p:id@bot:.',
    handler: async (ctx: ApiContext) => {
      const errors: ErrorRow[] = await ErrorRow.findAll({ where: { botId: ctx.data.bot.id } });
      ctx.answer(errors.map(v => v.toJSON()));
    }
  });

  // Remove bot error
  api.on({
    slug: 'bots.removeError',
    requirements: 'account <p:id@bot:. <p:errorId',
    handler: async (ctx: ApiContext) => {
      await ctx.lolire.core.botManager.errorLog.removeError(
        ctx.data.errorId,
        ctx.data.bot
      );

      ctx.answer('ok');
    }
  });
  
  // Flush all bot errors
  api.on({
    slug: 'bots.flushErrors',
    requirements: 'account <p:id@bot:.',
    handler: async (ctx: ApiContext) => {
      const removed = await ctx.lolire.core.botManager.errorLog.flushErrors(
        ctx.data.bot
      );
      
      ctx.answer(removed);
    }
  });
}