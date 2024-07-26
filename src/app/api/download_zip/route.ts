import { NextResponse, NextRequest } from "next/server";
import { downloader } from "@/lib/BatchDownloader";
import { corsHeaders } from "@/lib/utils";
import archiver from 'archiver';
import fs from 'fs';

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const run_name = url.searchParams.get('run_name') || '';

    // 1. Get Audio Folder
    const audio_folder = downloader().get_audio_folder(run_name);

    // 2. Compress the Folder to zip
    const out_stream = fs.createWriteStream('./src/resources/downloads/' + run_name + '.zip');
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    await new Promise((resolve, reject) => {
        out_stream.on('close', () => {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            resolve(null);
        });

        out_stream.on('end', () => {
            console.log('Data has been drained');
            resolve(null);
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                // log warning
                reject(err);
            } else {
                // throw error
                reject(err);
            }
        });
    
        archive.on('error', (err) => {
            reject(err);
        });
    
        archive.pipe(out_stream);
    
        archive.directory(audio_folder, false);
    
        archive.file(downloader().get_run_csv(run_name), { name: 'metadata.csv' });
    
        archive.finalize();
    });

    // 3. Return the zip file
    const zip_file = fs.readFileSync('./src/resources/downloads/' + run_name + '.zip');
    return new NextResponse(zip_file, {
        status: 200,
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${run_name}.zip"`,
            ...corsHeaders
        }
    });

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