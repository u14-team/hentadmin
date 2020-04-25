import { Hentadmin } from '../hentadmin';
import { ApiContext } from './apiContext';

import initAuthGroup from './groups/auth';
import initBotsGroup from './groups/bots';
import initOtherGroup from './groups/other';

export class ApiError extends Error {
  slug: string;
  data: any;

  constructor(slug: string, data: any = null) {
    super(slug);
    this.slug = slug;
    this.data = data;
  }
}

export class Api {
  ha: Hentadmin;
  methods = new Map<string, (ctx) => {}>();

  constructor(ha: Hentadmin) {
    this.ha = ha;
  }

  init() {
    this.method('test', ctx => ctx.answer('ok'));
    initAuthGroup(this);
    initBotsGroup(this);
    initOtherGroup(this);
  }

  group(slug) {
    const groupBuilder = {};
    groupBuilder['base'] = func => {
      this.method(slug, func);
      return groupBuilder;
    }

    groupBuilder['method'] = (methodSlug, func) => {
      this.method(`${slug}.${methodSlug}`, func);
      return groupBuilder;
    }

    return groupBuilder;
  }

  method(slug, func) {
    this.methods.set(slug, func);
  }

  handler(ctx) {
    const method = this.methods.get(ctx.query.method);
    if (!method) {
      this.ha.logger.warning(`${ctx.request.ip} > ${ctx.query.method}`);
      throw new ApiError('invalid_method', { method: ctx.query.method });
    }

    this.ha.logger.log(`${ctx.request.ip} > ${ctx.query.method}`);
    const context = new ApiContext(this.ha, ctx.query, ctx);
    return method(context);
  }
}