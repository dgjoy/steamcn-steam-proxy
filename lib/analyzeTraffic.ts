/**
 * 流量统计分析
 */
import * as http from 'http';
import * as winston from 'winston';

let totalTraffic: number = 0;

setInterval(
  () => {
    winston.info(`总流量：${totalTraffic / 1024 / 1024} MB`);
  },
  10000
);

export function analyzeTraffic (proxyRes: http.IncomingMessage, req: http.IncomingMessage, res: http.ServerResponse): void {
  function collectFn (chunk: Buffer): void {
    totalTraffic += chunk.byteLength;
  }
  proxyRes.on('data', collectFn);
  req.on('data', collectFn);
  res.on('data', collectFn);
}
