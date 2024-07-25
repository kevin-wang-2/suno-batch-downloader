import { NextResponse, NextRequest } from "next/server";
import { downloader } from "@/lib/BatchDownloader";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const run_name = url.searchParams.get('run_name');

    if (run_name === null) {

        const jobs = await downloader.get_all_running_jobs();

        return new NextResponse(JSON.stringify(jobs), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
    } else {
        const info = await downloader.check_run_status(run_name);

        return new NextResponse(JSON.stringify(info), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
    }
  } else {
    return new NextResponse('Method Not Allowed', {
      headers: {
        Allow: 'GET',
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