import { NextResponse, NextRequest } from "next/server";
import { downloader } from "@/lib/BatchDownloader";
import { corsHeaders } from "@/lib/utils";
import csv from "csvtojson";
import fs from "fs";


export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    if (req.method === 'GET') {
        const url = new URL(req.url);
        const run_name = url.searchParams.get('run_name') || '';



        if (url.searchParams.has('format') && url.searchParams.get('format') === 'csv') {
            // Return raw CSV file
            const filename = downloader().get_run_csv(run_name);
            const csv_string = fs.readFileSync(filename, 'utf-8');

            return new NextResponse(csv_string, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    ...corsHeaders
                }
            });
        } else {
            // Get Data
            try {
                const info = downloader().get_run_song_data(run_name);

                return new NextResponse(JSON.stringify(info), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            } catch (error) {
                return new NextResponse(JSON.stringify({ error: error }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }
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