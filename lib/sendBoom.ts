/**
 * sendBoom 方法实现
 */
import { BoomError, wrap } from 'boom';
import { ServerResponse } from 'http';
export function sendBoom (res: ServerResponse, boom: BoomError): void {
  if (!boom.isBoom) {
    boom = wrap(boom);
  }
  if (Boolean(boom.reformat)) {
    boom.reformat();
  }
  res.writeHead(boom.output.statusCode, boom.output.payload.error, {
    'Content-Type': 'application/json; charset=utf-8',
    ...boom.output.headers
  });
  res.end(JSON.stringify(boom.output.payload));
}

export const xee: number = 2;
