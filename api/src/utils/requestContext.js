import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();
export function withRequestContext(req, _res, next) {
  requestContext.run({ req }, next);
}
