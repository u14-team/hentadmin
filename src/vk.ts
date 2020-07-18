import { VK as VKLibrary } from 'vk-io';
import { Hentadmin } from './hentadmin';

export class VK extends VKLibrary {
  ha: Hentadmin;

  constructor(ha) {
    super();
    this.ha = ha;
  }

  init() {
    this.setOptions({ token: this.ha.lolire.config.vkToken });
    return this.checkToken();
  }

  checkToken() {
    return this.api.wall.get({ owner_id: 1 }).catch(err => {
      throw Error(`VK TOKEN is invalid (${err.message})`);
    });
  }
}
