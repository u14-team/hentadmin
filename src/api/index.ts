import initBotsApi from './bots';
import initStatsApi from './stats';

export function initApi (api) {
  initBotsApi(api);
  initStatsApi(api);
}