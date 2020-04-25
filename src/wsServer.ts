import { Hentadmin } from './hentadmin';
import * as Server from 'socket.io';
import { Session, Account } from './accountManager';

// States botlist, bot, console
export class WsServer {
  ha: Hentadmin;
  io: any;

  constructor(ha: Hentadmin) {
    this.ha = ha;
  }

  start() {
    this.io = new Server(this.ha.server.server, {
      path: '/rtc'
    });

    this.io.on('connection', this.newConnection.bind(this));
    this.io.origins('*:*');
  }

  emitSocket(event: string, object: any, socket: any, states: string[] = null) {
    if (states !== null && !states.find(v => v === socket.state.builded)) {
      return false;
    }

    socket.emit(event, object);
    return true;
  }

  emitIf(event: string, object: any, condition: (socket) => {}) {
    if (!this.io) {
      return 0;
    }

    let emitted = 0;
    Object.values(this.io.sockets.sockets).forEach((v: any) => {
      if (!condition(v)) {
        return;
      }
  
      v.emit(event, object);
      emitted++;
    });
    
    return emitted;
  }

  emitLogin(event: string, object: any, login: string, states: string[] = null) {
    return this.emitIf(event, object, socket =>
      socket.account.login !== login
        && (states === null || states.find(v => socket.state && v === socket.state.builded))
    );
  }

  emitId(event: string, object: any, id: number, states: string[] = null) {
    return this.emitIf(event, object, ({ account }) => account && account.id === id);
  }

  emitState(event: string, object: any, state: string) {
    return this.emitIf(event, object, v => v.state && state === v.state.builded);
  }

  async newConnection(socket) {
    this.ha.logger.log(`New socket: ${socket.handshake.address}`);
    if (!await this.authSocket(socket)) {
      this.ha.logger.log(`${socket.handshake.address}: auth failed.`);
      socket.disconnect();
    }

    socket.emit('connecting', 'success');
  }

  async authSocket(socket) {
    const { token } = socket.handshake.query;
    if (!token) {
      socket.emit('connecting', { slug: 'invalid_token', data: { token } });
      return false;
    }

    const session = await Session.findOne({ where: { token } });
    if (!session || !session.isLive(this.ha)) {
      socket.emit('connecting', { slug: 'invalid_token', data: { token } });
      return false;
    }

    if (session.ip !== socket.handshake.address) {
      socket.emit('connecting', { slug: 'invalid_token_ip', data: { ip: socket.handshake.address } });
      return false;
    }

    const account = await Account.findOne({ where: { login: session.login } });
    if (!account) {
      socket.emit('connecting', { slug: 'internal_error', data: null });
      return false;
    }

    await session.use();
    socket.account = account;
    socket.session = session;

    socket.on('state', newState => {
      socket.state = {
        builded: `${newState.slug}${newState.data ? `:${newState.data}` : ''}`,
        ...newState
      };

      console.log(socket.state)
    });

    return true;
  }
}