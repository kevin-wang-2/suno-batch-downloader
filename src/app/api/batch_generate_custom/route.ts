import { NextResponse, NextRequest } from "next/server";
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";
import csv from "csvtojson";
import fs from "fs";
import https from "https";

export const dynamic = "force-dynamic";

const MAX_WORKER_COUNT = 10;
let cur_worker_count = 0;

interface IGeneratePrompt {
    index: string,
    lyrics: string,
    tags: string,
    make_instrumental?: Boolean,
    model?: string
}

let queue = Array<IGeneratePrompt>();
let total_count = 0;

export async function POST(req: NextRequest) {
  if (req.method === 'POST') {
      const body = await req.json();
      const { csv_string, run_name } = body;

      if (queue.length > 0) {
        return new NextResponse(JSON.stringify({ error: 'Already processing' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // 1. Process CSV -> queue

      queue = await csv().fromString(csv_string);
      total_count = queue.length;

      // Create download_${run_name} directory if not exist, use inc number to create unique name if exists
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
            content = await (await sunoApi).custom_generate(
                item.lyrics,
                item.tags,
                item.index,
                Boolean(item.make_instrumental),
                item.model || DEFAULT_MODEL,
                true
            );
         } catch(e) {
            console.error(e);

            // Push item back to queue
            queue.push(item);

            continue;
         }
          
          
          // 4. Download Audio and Record to CSV
        for (let i = 0; i < content.length; i++) {
          const audio_url = content[i]["audio_url"] || "";
          const file_name = `${item.index}-${i + 1}.mp3`;

          (new Promise((resolve, reject) => {
            const file = fs.createWriteStream(`${directory}/${file_name}`);
            const request = https.get(audio_url, response => {
              response.pipe(file);
    
              file.on("finish", () => {
                resolve(undefined)
              });

              file.on("error", (err) => {
                reject(err)
              })
            }).on("error", (err) => {
              reject(err)
            })
          })).catch((e: Error) => {
            fs.appendFileSync('../download/download_error.txt', `${item.index} - ${e.toString()}\n`);
          });

        }

        // 5. Wait for Complete
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

        cur_worker_count--;
        console.log(`[Worker ${id}] ${item.index} Done, ${cur_worker_count} remaining`);
        }
      }

      for (let worker_num = 0; worker_num < MAX_WORKER_COUNT; worker_num++) {
        worker(worker_num);
        // Wait 10 ms
        await new Promise(res => setTimeout(res, 10));
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