import { NextResponse, NextRequest } from "next/server";
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_WORKER_COUNT = 10;
let cur_worker_count = 0;

export async function POST(req: NextRequest) {
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { prompt, make_instrumental, model } = body;

      if (!prompt) {
        return new NextResponse(JSON.stringify({ error: 'Prompt is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      if(cur_worker_count >= MAX_WORKER_COUNT) {
        return new NextResponse(JSON.stringify([]), {
            status: 200,
            headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
            }
        });
      } else {
        cur_worker_count++;

        const audioInfo = await (await sunoApi).generate(
            prompt,
            Boolean(make_instrumental),
            model || DEFAULT_MODEL,
            true
        );

        cur_worker_count--;

        return new NextResponse(JSON.stringify(audioInfo), {
            status: 200,
            headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
            }
        });
      }
    } catch (error: any) {
      console.error('Error generating custom audio:', JSON.stringify(error.response.data));
      if (error.response.status === 402) {
        return new NextResponse(JSON.stringify({ error: error.response.data.detail }), {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      return new NextResponse(JSON.stringify({ error: 'Internal server error: ' + JSON.stringify(error.response.data.detail) }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
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