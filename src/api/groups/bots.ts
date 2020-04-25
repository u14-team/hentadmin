import { Bot } from '../../botManager';
import { Account } from '../../accountManager';
import { ApiError } from '../api';
import { ApiContext } from '../apiContext';

async function bots(ctx) {
  const { account } = await ctx.assertAccount();
  const bots = await Bot.findAll({ where: { ownerId: account.id } });

  ctx.answer(bots.map(v => v.toJSON()));
}

async function botsGet(ctx) {
  const { account } = await ctx.assertAccount();
  const botId = ctx.assertParam('id');
  const bot = await Bot.findOne({ where: { ownerId: account.id, id: botId } });

  ctx.answer(bot.toJSON());
}

async function botsCommand(ctx: ApiContext) {
  const { account } = await ctx.assertAccount();
  const botId = ctx.assertParam('id');
  const command = ctx.assertParam('command');

  const bot = await Bot.findOne({ where: { ownerId: account.id, id: botId } });
  if (!bot) {
    throw new ApiError('no_item', { type: 'bot', id: botId, owner: account.id });
  }

  if (bot.status !== 'enabled') {
    throw new ApiError('invalid_data', { type: 'status', expected: 'enabled', real: bot.status });
  }

  const instance = ctx.ha.botManager.botInstances.get(bot.id);
  instance.process.stdin.write(`${command}\n`);
  ctx.answer('ok');
}

async function botsCtl(ctx: ApiContext) {
  const { account } = await ctx.assertAccount();
  const botId = ctx.assertParam('id');
  const command = ctx.assertParam('command');
  const bot: Bot = await Bot.findOne({ where: { ownerId: account.id, id: botId } });
  if (!bot) {
    throw new ApiError('no_item', { type: 'bot', id: botId, owner: account.id });
  }
  
  const allowed = {
    enabled: ['disable', 'reload'],
    enabling: ['disable'],
    disabled: ['enable'],
    failed: ['enable'],
    disabling: [],
    reloading: ['disable']
  };

  if (!allowed[bot.status].includes(command)) {
    throw new ApiError('invalid_data', { type: 'command', expected: allowed[bot.status], real: command });
  }

  switch(command) {
    case 'enable':
      ctx.ha.botManager.enableBot(bot);
      break;
    case 'disable':
      ctx.ha.botManager.disableBot(bot);
      break;
    case 'reload':
      ctx.ha.botManager.disableBot(bot, true);
      break;
  }

  ctx.answer('ok');
}

async function botsVk(ctx) {
  const botVkId = ctx.assertParam('vkId');
  ctx.answer({
    name: 'Бот Ботя',
    groupId: botVkId
  });
}

export default function initApi(api) {
  api.group('bots')
    .base(bots)
    .method('get', botsGet)
    .method('command', botsCommand)
    .method('ctl', botsCtl)
    .method('vk', botsVk);
}