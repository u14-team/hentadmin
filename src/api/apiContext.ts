import { Hentadmin } from '../hentadmin';
import { ApiError } from './api';
import { Session, Account } from '../accountManager';

export class ApiContext {
  ha: Hentadmin;
  params: any;
  connectionContext: any;

  constructor(ha, params, connectionContext) {
    this.ha = ha;
    this.params = params;
    this.connectionContext = connectionContext;
  }

  answer(response) {
    this.connectionContext.body = { response };
  }

  assertParam(param: string) {
    const value = this.params[param];
    if (!value) {
      throw new ApiError('invalid_param', { param });
    }

    return value;
  }
  
  async assertAccount() {
    const token = this.assertParam('token');
    const session = await Session.findOne({ where: { token } });
    if (!session || !session.isLive(this.ha)) {
      throw new ApiError('invalid_token', { token });
    }

    if (session.ip !== this.connectionContext.request.ip) {
      throw new ApiError('invalid_token_ip', { ip: this.connectionContext.request.ip });
    }

    const account = await Account.findOne({ where: { login: session.login } });
    if (!account) {
      throw new ApiError('internal_error');
    }

    await session.use();
    return { session, account };
  }
}