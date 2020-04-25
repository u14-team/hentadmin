import * as Koa from 'koa';
import * as Router from 'koa-router';
import { Hentadmin } from './hentadmin';
import { ApiError } from './api/api';
import * as cors from '@koa/cors';
import { Server as HttpServer } from 'http';
import { WsServer } from './wsServer';


export class Server {
  ha: Hentadmin;
  ws: WsServer;
  app = new Koa();
  router = new Router();
  server: HttpServer;

  constructor(ha: Hentadmin) {
    this.ha = ha;
    this.ws = new WsServer(ha);
  }

  start() {
    this.router.get('/', this.ha.api.handler.bind(this.ha.api));

    this.app
      .use(cors())
      .use(this.handleError.bind(this))
      .use(this.router.routes())
      .use(this.router.allowedMethods());

    this.server = new HttpServer(this.app.callback());
    this.ws.start();
    this.server.listen(this.ha.config.port);
  }

  async handleError(ctx, next) {
    try {
      await next();
    } catch(error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }

      ctx.body = { error: { slug: error.slug, data: error.data } };
    }
  }
}