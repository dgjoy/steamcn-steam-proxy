/**
 * 关键词审查相关
 */
import { createReadStream } from 'fs';
import * as http from 'http';
import * as path from 'path';
import { createInterface, ReadLine } from 'readline';
import * as stream from 'stream';
import * as winston from 'winston';
import * as zlib from 'zlib';

interface IWordsMapNode {
  isEnd: boolean;
  children: {
    [key: string]: IWordsMapNode;
  };
}

const keywordsMap: IWordsMapNode = { isEnd: false, children: {} };

const lineReader: ReadLine = createInterface({
  input: createReadStream(path.join(__dirname, 'keywords.txt'), { encoding: 'utf-8' })
});

lineReader.on('line', (line: string) => {
  if (!line) {
    return;
  }
  const words: string[] = [line];
  let unicodeEscapeWord: string = '';
  for (let i: number = 0; i < line.length; i += 1) {
    unicodeEscapeWord += `\\u${(<number>line.codePointAt(i)).toString(16)}`;
  }
  words.push(unicodeEscapeWord);
  for (const word of words) {
    let parent: IWordsMapNode = keywordsMap;
    for (const char of word) {
      if (!parent.children[char]) {
        parent.children[char] = { isEnd: false, children: {} };
      }
      parent = parent.children[char];
    }
    parent.isEnd = true;
  }
});

class CensorshipTransform extends stream.Transform {
  private tail: string = '';

  // tslint:disable-next-line:function-name variable-name
  public _transform (chunk: Buffer, _encoding: string, callback: Function): void {
    let s: string = this.tail + chunk.toString();
    this.tail = '';
    let parent: IWordsMapNode = keywordsMap;

    for (let i: number = 0; i < s.length; i += 1) {
      let found: boolean = false;
      let skip: number = 0;
      let sWord: string = '';
      let isTail: boolean = false;

      for (let j: number = i; j < s.length; j += 1) {
        if (!parent.children[s[j]]) {
          found = false;
          skip = j - i;
          parent = keywordsMap;
          break;
        }

        sWord = sWord + s[j];
        if (parent.children[s[j]].isEnd) {
          found = true;
          skip = j - i;
          break;
        }

        if (j === s.length - 1) {
          isTail = true;
        }
        parent = parent.children[s[j]];
      }

      if (skip > 1) {
        i += skip - 1;
      }

      if (isTail) {
        this.tail = s.substring(i);
        s = s.substring(0, i);
        break;
      }

      if (!found) {
        continue;
      }

      s = s.replace(sWord, '♥'.repeat(sWord.startsWith('\\u') ? sWord.length / 6 : sWord.length));
    }
    this.push(s);
    callback();
  }

  // tslint:disable-next-line:function-name
  public _flush (callback: Function): void {
    if (this.tail) {
      this.push(this.tail);
    }
    callback();
  }
}

export function censorResponse (proxyRes: http.IncomingMessage, res: http.ServerResponse): void {
  if (!/text\/html|application\/json/.test(<string>proxyRes.headers['content-type'])) {
    return;
  }
  // tslint:disable-next-line:typedef
  const writeRes = res.write;
  // tslint:disable-next-line:typedef
  const endRes = res.end;
  let unzip: stream.Transform;
  let zip: stream.Transform;
  switch (proxyRes.headers['content-encoding']) {
    case 'gzip':
    unzip = zlib.createGunzip();
    zip = zlib.createGzip();
    delete proxyRes.headers['content-length'];
    res.setHeader('Transfer-Encoding', 'chunked');
    break;

    case 'deflate':
    unzip = zlib.createInflate();
    zip = zlib.createDeflate();
    delete proxyRes.headers['content-length'];
    res.setHeader('Transfer-Encoding', 'chunked');
    break;

    default:
    unzip = new stream.PassThrough();
    zip = new stream.PassThrough();
  }
  unzip.pipe(new CensorshipTransform()).pipe(zip);
  // tslint:disable-next-line:no-any
  res.write = (chunk: any): boolean => {
    return unzip.write(chunk);
  };
  res.end = (): void => {
    return unzip.end();
  };
  zip.on('data', (chunk: string | Buffer): void => {
    writeRes.call(res, chunk);
  });
  zip.on('end', () => {
    endRes.call(res);
  });
  unzip.on('drain', () => {
    res.emit('drain');
  });
  unzip.on('error', (err: Error) => {
    winston.debug('Zlib uncompress error', err);
  });
  zip.on('error', (err: Error) => {
    winston.debug('Zlib compress error', err);
  });
}
