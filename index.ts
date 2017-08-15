/**
 * 运行入口
 */
import * as Boom from 'boom';
import * as http from 'http';
import * as httpProxy from 'http-proxy';
import * as jwt from 'jsonwebtoken';
import * as net from 'net';
import * as ProxyAgent from 'proxy-agent';
import * as winston from 'winston';

import { analyzeTraffic } from './lib/analyzeTraffic';
import { censorResponse } from './lib/censorResponse';
import { sendBoom } from './lib/sendBoom';

const agent: http.Agent = new ProxyAgent('socks5://127.0.0.1:1080');
const proxy: httpProxy = httpProxy.createProxyServer({ agent });
const DOMAIN_WHITELIST: string[] = ['store.steampowered.com', 'steamcommunity.com'];
// tslint:disable-next-line:no-multiline-string
const JWT_PUBLIC_KEY: string = `-----BEGIN PUBLIC KEY-----
MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgEtZXoXVAAq7QZDgg5orKChVOkDd
OxVVt6wpU5uIUZ6qgSEYqEzFhZ9wKFxl0YoJv9R8TUaHn7BMDWppaT2vjQhalQ86
0bzhOsAjQWsx4V12P3On1CYbCSO0DVPC5FIZ5G4pg8KR8Vcgm+fb0RKxiEtzyG7o
+VVoPsblZeYMpinzAgMBAAE=
-----END PUBLIC KEY-----`;

interface IAuthorizationToken {
  uid: number;
  userName: string;
}

const server: http.Server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  if (!DOMAIN_WHITELIST.includes(<string>req.headers.host)) {
    sendBoom(res, Boom.notImplemented('不支持代理该域名'));

    return;
  }
  let authorizationToken: IAuthorizationToken;
  try {
    // tslint:disable-next-line:no-any
    authorizationToken = <any>jwt.verify(req.headers['x-authorization-code'], JWT_PUBLIC_KEY);
  } catch (e) {
    sendBoom(res, Boom.unauthorized('认证失败，授权码无效'));

    return;
  }
  let steamId: string = '未登录';
  if (req.headers.cookie) {
    const match: RegExpMatchArray | null = (<string>req.headers.cookie).match(/steamLogin=(\d+)/);
    if (match) {
      steamId = match[1];
    }
  }
  const remoteAddress: string = <string>req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  // tslint:disable-next-line:max-line-length
  winston.info(`新请求来自 ${remoteAddress} [(${authorizationToken.uid}) ${authorizationToken.userName}] [${steamId}] - ${req.headers.host}${req.url}`);
  proxy.web(req, res, {
    // tslint:disable-next-line:no-http-string
    target: `http://${req.headers.host}`
  });
});

server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  proxy.ws(req, socket, head);
});

proxy.on('proxyRes', (proxyRes: http.IncomingMessage, req: http.IncomingMessage, res: http.ServerResponse) => {
  censorResponse(proxyRes, res);
  analyzeTraffic(proxyRes, req, res);
});

proxy.on('error', (err: Error) => {
  winston.error('代理请求出错', err);
});

server.listen(27015);
winston.info('监听中...');
