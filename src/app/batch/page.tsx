'use client'
import React from 'react';
import Section from '../components/Section';

import axios from 'axios';
import { IRunStatus, ICSVRow } from '@/lib/BatchDownloader';

const escapedNewLineToLineBreakTag = (string: string) => string.split('\n').map((item, index) => (index === 0) ? item : [<br key={index} />, item])

export default function Batch() {
    const [run_name, set_run_name] = React.useState('');
    const [csv_string, set_csv_string] = React.useState('');
    const [job_count, set_job_count] = React.useState(0);
    const [show_run_status, set_show_run_status] = React.useState(false);
    const [csv_data, set_csv_data] = React.useState(Array<ICSVRow>());
    const [check_interval, set_check_interval] = React.useState<NodeJS.Timeout>();

    async function submit_run() {
        const result = await axios.post('/api/batch_generate', {
            run_name, csv_string
        });

        set_run_name(result.data['run_name']);

        check_run();
        set_show_run_status(true);

        // Start an interval to check the run status
        let interval = setInterval(async () => {
            const check_result = await axios.get(`/api/batch_status?run_name=${result.data['run_name']}`);
            const run_status: IRunStatus = check_result.data;
            
            if (run_status.ended) {
                set_job_count(0);
                clearInterval(interval);
            } else {
                set_job_count(run_status.remaining_count || 0);
            }
    
            set_show_run_status(true);
    
            const csv = await axios.get(`/api/fetch_batch_csv?run_name=${result.data['run_name']}`);
            set_csv_data(csv.data);
        }, 1000);

        set_check_interval(interval);

    }

    async function check_run() {
        const result = await axios.get(`/api/batch_status?run_name=${run_name}`);
        const run_status: IRunStatus = result.data;
        
        if (run_status.ended) {
            set_job_count(0);
        } else {
            set_job_count(run_status.remaining_count || 0);
        }

        set_show_run_status(true);

        const csv = await axios.get(`/api/fetch_batch_csv?run_name=${run_name}`);
        set_csv_data(csv.data);
    }

    return (
        <>
            <Section className="my-10">
                <article className="prose lg:prose-lg max-w-3xl pt-10">
                    <h1 className=' text-center text-indigo-900'>
                        Batch Downloader
                    </h1>
                    <div className="space-y-6 mt-10 sm:mx-auto sm:w-full">
                        <div>
                            <label className='font-medium text-xl text-indigo-900 flex items-center gap-2' htmlFor="run_name">Run Title</label>
                            <div className='mt-2'>
                                <input name="run_name" value={run_name} onChange={e => set_run_name(e.target.value)} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"></input>
                            </div>
                        </div>
                        <div>
                            <label className='font-medium text-xl text-indigo-900 flex items-center gap-2'>CSV Data</label>
                            <textarea onChange={e => set_csv_string(e.target.value)} defaultValue={csv_string} rows={10} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"></textarea>
                        </div>
                        <button onClick={submit_run} className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Submit</button>
                        <button onClick={check_run} className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Check</button>
                    </div>
                    { show_run_status &&
                    <>
                    <div className="text-gray-500">
                        Run {run_name}, {job_count} jobs left. {job_count === 0 ? 'Run finished.' : ''}
                    </div>
                    <table style={{overflowX: 'auto', whiteSpace: 'wrap'}}>
                        <thead>
                            <tr>
                                <th>Index</th>
                                <th>Title</th>
                                <th>Lyrics</th>
                                <th>Stream</th>
                                <th>{job_count == 0 ? <a href={`/api/download_zip?run_name=${run_name}`}>Download</a> :'Download'}</th>
                            </tr>
                        </thead>
                        {csv_data.map((row, index) => {
                            if (row['error'] !== "") {
                                // Combine Lyrics, Stream, Download to show error message
                                return (
                                    <tr key={index} style={{borderBottom: '1px solid black'}}>
                                        <td>{row['index']}-{row['cnt']}</td>
                                        <td>{row['song_id']}</td>
                                        <td>Error: {row['error']}</td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                )
                            } else {
                                return (
                                    <tr key={index} style={{borderBottom: '1px solid black'}}>
                                        <td>{row['index']}-{row['cnt']}</td>
                                        <td>{row['title']}</td>
                                        <td>{escapedNewLineToLineBreakTag(row['lyrics'])}</td>
                                        <td><a href={row['audio_url']} download>Stream</a></td>
                                        <td><a href={row['audio_url']} download>Download</a></td>
                                    </tr>
                                )
                            }
                        })
                        }
                    </table>
                    </>
                    }
                    
                </article>
            </Section>
        </>
    )
}