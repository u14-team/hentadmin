import { Bot } from '../bot/bot';
import { ApiError } from 'lolire/lib/api/api';
import { ApiContext } from 'lolire';
import { promises as fs } from 'fs';
import { ErrorRow } from '../bot/errorLog';
import { initBotsApiTypes } from './resolvers/bots'
import { BotManager } from '../bot/manager';

export default function initApi(api) {
  initBotsApiTypes(api);
  
  // Get stats parts
  api.on({
    slug: 'stats.getParts',
    requirements: 'account <p:id@bot:.',
    handler: async (ctx: ApiContext) => {
      if (!['enabled'].includes(ctx.data.bot.status)) {
        throw new ApiError('invalid_data', {
          type: 'status',
          expected: ['enabled'],
          real: ctx.data.bot.status
        });
      }
      
      const { processManager } = ctx.lolire.core.botManager;
      ctx.answer(await processManager.sendHa(ctx.data.bot.id, { type: 'getStatsParts' }));
    }
  });

  // Get stats data
  api.on({
    slug: 'stats.get',
    requirements: 'account <p:id@bot:. p:slug',
    handler: async (ctx: ApiContext) => {
      if (!['enabled'].includes(ctx.data.bot.status)) {
        throw new ApiError('invalid_data', {
          type: 'status',
          expected: ['enabled'],
          real: ctx.data.bot.status
        });
      }
      
      const { processManager } = ctx.lolire.core.botManager;
      try {
        ctx.answer({
          slug: ctx.data.slug,
          ...await processManager.sendHa(ctx.data.bot.id, {
            type: 'getStats',
            slug: ctx.data.slug
          })
        });
      } catch (error) {
        console.log(error.stack)
        throw new ApiError('invalid_data', {
          type: 'slug',
          real: ctx.data.slug
        });
      }
    }
  });
}