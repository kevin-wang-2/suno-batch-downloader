import { NextResponse, NextRequest } from "next/server";
import { downloader } from "@/lib/BatchDownloader";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.method === 'POST') {
    const body = await req.json();
    const { csv_string, run_name } = body;

    const run = downloader.start_run(run_name, csv_string);

    return new NextResponse(JSON.stringify(run), {
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