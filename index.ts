/**
 * 运行入口
 */
import * as Boom from 'boom';
import * as http from 'http';
import * as httpProxy from 'http-proxy';
import * as net from 'net';
import * as ProxyAgent from 'proxy-agent';
import * as winston from 'winston';

import { analyzeTraffic } from './lib/analyzeTraffic';
import { censorResponse } from './lib/censorResponse';
import { sendBoom } from './lib/sendBoom';

const agent: http.Agent = new ProxyAgent('socks5://127.0.0.1:1080');
const proxy: httpProxy = httpProxy.createProxyServer({ agent });
const DOMAIN_WHITELIST: string[] = ['store.steampowered.com', 'steamcommunity.com'];

const server: http.Server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  if (!DOMAIN_WHITELIST.includes(<string>req.headers.host)) {
    sendBoom(res, Boom.notImplemented('不支持代理该域名'));

    return;
  }
  winston.info(`新请求来自 ${req.socket.remoteAddress} - ${req.headers.host}${req.url}`);
  proxy.web(req, res, {
    // tslint:disable-next-line:no-http-string
    target: `http://${req.headers.host}`,
    xfwd: true
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

server.listen(80);
winston.info('监听中...');
