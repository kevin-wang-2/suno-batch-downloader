import { NextResponse, NextRequest } from "next/server";
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";
import csv from "csvtojson";
import fs from "fs";
import https from "https";

export const dynamic = "force-dynamic";

const MAX_WORKER_COUNT = 2;
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
      const { csv_string } = body;

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

      // 2. Start worker x 10

      const worker = async () => {
        while (queue.length > 0) {
          // 1. Yield
          await new Promise(res => setTimeout(res));

          // 2. Fetch stuff
          const item = queue[queue.length - 1];
          if (!item) break;
          queue.pop();

          // 3. Start Generating
          const content = await (await sunoApi).custom_generate(
            item.lyrics,
            item.tags,
            item.index,
            Boolean(item.make_instrumental),
            item.model || DEFAULT_MODEL,
            true
          );
          
          
          // 4. Download Audio and Record to CSV
          for (let i = 0; i < content.length; i++) {
            const audio_url = content[i]["audio_url"] || "";
            const file_name = `${item.index}-${i + 1}.mp3`

            await new Promise(resolve => {
              const file = fs.createWriteStream(`../download/${file_name}`);
              const request = https.get(audio_url, response => {
                response.pipe(file);
 
                file.on("finish", () => {
                  resolve(undefined)
                })
              })
            });

            console.log(`[Worker] ${item.index} - ${i + 1} Done`)
          }
        }
      }

      for (let worker_num = 0; worker_num < MAX_WORKER_COUNT; worker_num++) {
        worker();
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