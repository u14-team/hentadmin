import { Account } from '../../accountManager';
import { ApiError } from '../api';
import * as passwordHash from 'password-hash';

async function auth(ctx) {
  const login = ctx.assertParam('login');
  const password = ctx.assertParam('password');

  const account = await Account.findOne({ where: { login } });
  if (!account) {
    throw new ApiError('invalid_auth');
  }

  if (!passwordHash.verify(password, account.hashedPassword)) {
    throw new ApiError('invalid_auth');
  }

  const session = await ctx.ha.accountManager.createSession(login, ctx.connectionContext.request.ip);
  ctx.answer(session.token);
}

async function authCheck(ctx) {
  const token = ctx.assertParam('token');
  try {
    const { account: { login, id } } = await ctx.assertAccount(token);
    ctx.answer({ status: 'valid', login, id });
  } catch (error) {
    console.log(error.stack)
    ctx.answer({ status: 'invalid' });
  }
}

export default function initApi(api) {
  api.group('auth')
    .base(auth)
    .method('check', authCheck);
}