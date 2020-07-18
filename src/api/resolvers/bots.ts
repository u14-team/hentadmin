import { Api, ApiContext } from 'lolire';
import { Bot } from '../../bot/bot';

export function initBotsApiTypes(api: Api) {
  api.processor.add('bot', (ctx: ApiContext, param: string) =>
    Bot.findOne({ where: { ownerId: ctx.data.account.id, id: param } })
  );
}