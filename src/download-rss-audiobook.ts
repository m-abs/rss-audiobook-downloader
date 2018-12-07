import FeedParser from 'feedparser';
import * as fs from 'fs';
import * as path from 'path';
import request from 'request';
import * as URL from 'url';
import { promisify } from 'util';

const fsExists = promisify(fs.exists);

async function downloadFile(url: string, filename: string) {
  if (await fsExists(filename)) {
    console.warn(`"${filename}" exists`);
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const fileStream = fs.createWriteStream(filename);

    const req = request(url);

    req.on('response', (res) => {
      if (res.statusCode !== 200) {
        fileStream.close();
        reject();

        return;
      }

      req.pipe(fileStream);
    });

    req.on('end', () => {
      console.debug(`"${url}" downloaded to "${filename}"`);

      resolve();
    });

    req.on('error', (err) => reject(err));
  });
}

function worker(url: string) {
  const req = request(url);

  const feed = new FeedParser({});

  req.on('error', (error) => {
    // handle any request errors
    console.error(error);
  });

  req.on('response', (res) => {
    if (res.statusCode !== 200) {
      throw new Error(`${res.statusCode}`);
    }

    req.pipe(feed);
  });

  const items = [] as FeedParser.Item[];

  feed.on('readable', () => {
    for (let i = 0; true; i += 1) {
      const item = feed.read();
      if (!item) {
        break;
      }

      items.push(item);
    }
  });

  feed.on('end', async () => {
    for (const [idx, item] of Object.entries(items.reverse())) {
      const i = `${Number(idx) + 1}`;

      const downloadUrl =
        typeof item.enclosures[0] === 'string'
          ? item.enclosures[0]
          : (item.enclosures[0] as any).url;
      const ext = path.extname(URL.parse(downloadUrl).path!);

      const filename = `${i.padStart(3, '0')} ${item.title}${ext}`;
      if (!(await fsExists(filename))) {
        await downloadFile(downloadUrl, filename);
      }
    }
  });

  feed.on('error', (error: any) => {
    // handle any request errors
    console.error(error);
  });
}

worker('http://parahumanaudio.com/feed/podcast/ward-audiobook');
