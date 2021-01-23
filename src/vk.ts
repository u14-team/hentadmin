import { VK as VKLibrary } from 'vk-io';
import { Hentadmin } from './hentadmin';

export class VK extends VKLibrary {
  ha: Hentadmin;

  constructor(ha) {
    super({ token: ha.lolire.config.vkToken });
    this.ha = ha;
  }

  init() {
    return this.checkToken();
  }

  checkToken() {
    return this.api.wall.get({ owner_id: 1 }).catch(err => {
      throw Error(`VK TOKEN is invalid (${err.message})`);
    });
  }
}
