import { NextResponse, NextRequest } from "next/server";
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";
import csv from "csvtojson";
import fs from "fs";
import https from "https";

export const dynamic = "force-dynamic";

const MAX_WORKER_COUNT = 5;
let cur_worker_count = 0;

interface IGeneratePrompt {
    index: string,
    prompt: string,
    make_instrumental?: Boolean,
    model?: string
}

let queue = Array<IGeneratePrompt>();
let total_count = 0;

function getExt(url: string) {
    const index = url.lastIndexOf('.')
    const ext = url.substring(index, url.length)
    if (ext === '.') {
        return '.mp3'
    } else {
        return ext
    }
}

class CSVWriter {
    private fd: number;
    private header: Array<string> = [];

    constructor(filename: string, append = false) {
        if (fs.existsSync(filename) && append) {
            // TODO: Consider the append case
            throw 'Unimplemented'
        } else {
            try {
                this.fd = fs.openSync(filename, 'w')
            } catch (e) {
                console.error(`Cannot Open CSV file ${filename} for write.`)
                throw e
            }
        }
    }

    _preprocess(item: any) {
        let stgItem = '';
        if (typeof item === 'object') {
            if (item === null) {
                stgItem = 'null';
            } else {
                stgItem = JSON.stringify(item);
            }
        } else {
            stgItem = item.toString();
        }
        let needEscape = false;
        if (stgItem.indexOf('\n') !== -1 || stgItem.indexOf(',') !== -1) {
            needEscape = true;
        }
        if (stgItem.indexOf('"') !== -1) {
            stgItem = stgItem.replace(/"/g, '""')
            needEscape = true;
        }
        if (needEscape) {
            return `"${stgItem}"`
        } else {
            return stgItem
        }

    }

    async writeArray(arr: Array<any>) {
        if (!this.header) throw 'Header not yet set'

        // 1. Format Array into sting
        let line = this._preprocess(arr[0])
        for (let i = 1; i < arr.length; i++) {
            line += `,${this._preprocess(arr[i])}`
        }
        line += '\n'

        // 2. Write
        await new Promise((resolve, reject) => {
            fs.write(this.fd, line, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(undefined)
                }
            })
        })
    }

    async writeObjectLine(obj: any) {
        if (this.header.length == 0) {
            const header = []
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    header.push(key)
                }
            }
            await this.setHeader(header)
        }

        // Write each key in header order
        let line = this._preprocess(obj[this.header[0]])
        for (let i = 1; i < this.header.length; i++) {
            line += `,${this._preprocess(obj[this.header[i]])}`
        }
        line += '\n';

        // Write
        await new Promise((resolve, reject) => {
            fs.write(this.fd, line, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(undefined)
                }
            })
        })
    }

    async setHeader(header: Array<string>) {
        if (this.header.length != 0) throw 'Header Already Set'
        this.header = header;
        await this.writeArray(header)
    }

    async writeObject(obj: any) {
        if (this.header.length == 0) {
            const header = []
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    header.push(key)
                }
            }
            await this.setHeader(header)
        }
        const arr = new Array(this.header.length);
        for (let i = 0; i < this.header.length; i++) {
            if(this.header[i].indexOf('.') !== -1) {
                let seg = obj;
                for (const part of this.header[i].split('.')) {
                    if (seg === undefined || seg === null || !seg.hasOwnProperty(part)) {
                        seg = undefined
                        break;
                    }
                    seg = seg[part];
                }
                if (seg === undefined) {
                    arr[i] = '';
                } else {
                    arr[i] = seg;
                }
            } else {
                arr[i] = obj[this.header[i]];
                if (arr[i] === undefined) {
                    arr[i] = '';
                }
            }
        }
        await this.writeArray(arr)
    }

    async writeList(list: Array<any>) {
        for (const object of list) {
            await this.writeObject(object);
        }
    }

    disconnect() {
        fs.closeSync(this.fd)
    }
}


export async function POST(req: NextRequest) {
  if (req.method === 'POST') {
      const body = await req.json();
      const { csv_string, run_name } = body;

      const writer = new CSVWriter(`../${run_name}.csv`)

      // 1. Process CSV -> queue

      queue = await csv().fromString(csv_string);
      total_count = queue.length;

      let i = 0;
      while (fs.existsSync(`../download-${run_name}-${i}`)) {
        i++;
      }
      fs.mkdirSync(`../download-${run_name}-${i}`);
      const directory = `../download-${run_name}-${i}`;

      // 2. Start worker x 10

      const worker = async (id:number) => {
        cur_worker_count++;
        while (queue.length > 0) {
          // 1. Yield
          await new Promise(res => setTimeout(res));

          // 2. Fetch stuff
          const item = queue[queue.length - 1];
          if (!item) break;
          queue.pop();

          // 3. Start Generating
          let content:any;
          try {
            content = await (await sunoApi).generate(
              item.prompt,
              Boolean(item.make_instrumental),
              item.model || DEFAULT_MODEL,
              true
            );
          } catch(e) {
            // Push item back to queue
            queue.push(item);
            console.error(e);

            await new Promise(res => setTimeout(res, 1000));
            continue;
          }
          
          
          // 4. Download Audio and Record to CSV
          for (let i = 0; i < content.length; i++) {
            const audio_url = content[i]["audio_url"] || "";
            const file_name = `${item.index}-${i}.mp3`;

            (new Promise((resolve, reject) => {
              const file = fs.createWriteStream(`${directory}/${file_name}`);
              const request = https.get(audio_url, response => {
                response.pipe(file);
 
                file.on("finish", () => {
                  resolve(undefined)
                });

                file.on("error", (err) => {
                  reject(err)
                }).on("error", (err) => {
                  reject(err)
                });
              })
            })).then(() => {
              return writer.writeObjectLine({
                index: item.index,
                cnt: i,
                title: content[i]["title"],
                file_name: file_name,
                lyrics: content[i]["lyric"]
              })
            }).then(() => {
              console.log(`Download: ${item.index} - ${i} Done`)
            }).catch((e) => {
              console.error(`Download: ${item.index} - ${i} Failed`);
              // Write to log
              fs.appendFileSync('../download/download_error.txt', `${item.index} - ${i} ${content[i]["title"]}\n${e.toString()}`);
            });
          }

          // 5. Wait till status becomes complete
          while (1) {
            if (content.every((item: any) => item.status === 'complete')) {
              break;
            }

            try {
                content = await (await sunoApi).get(content.map((item: any) => item.id));
            } catch(e) {
                continue;
            }
          }

          console.log(`[Worker ${id}] ${item.index} Done`)
        }
        cur_worker_count--;
        console.log(`Worker ${id} Exited, ${cur_worker_count} remaining`);
      }

      for (let worker_num = 0; worker_num < MAX_WORKER_COUNT; worker_num++) {
        worker(worker_num);
        // Wait 1000ms before starting
        await new Promise(res => setTimeout(res, 1000));
      }
      
      return new NextResponse(JSON.stringify({}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'POST',
        ...corsHeaders
      },
      status: 405
    });
  }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}