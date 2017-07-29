/**
 * Typings for proxy-agent
 */
import { Agent } from 'http';

declare namespace proxyAgent {
  interface ProxyAgent {
    new (uri: string): Agent;
  }
}

declare const proxyAgent: proxyAgent.ProxyAgent;
export = proxyAgent;
