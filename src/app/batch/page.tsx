'use client'
import React from 'react';

import axios from 'axios';
import { IRunStatus, IGeneratePrompt, ISong, statusMap } from '@/lib/BatchDownloaderUtils';
import csv from "csvtojson";
import { CSVFormatter } from '@/lib/CSVFormatter';

import Kanban from '@/app/components/batch/Kanban';

const escapedNewLineToLineBreakTag = (string: string) => string.split('\n').map((item, index) => (index === 0) ? item : [<br key={index} />, item])

function EditableText(value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void) {
    const [editMode, setEditMode] = React.useState(false);


    return (
        <div>
            {editMode ?
                <textarea defaultValue={value} onChange={onChange} onBlur={() => setEditMode(false)} className='block w-full' rows={(value.match(/\n/g) || []).length + 1}></textarea>
                :
                <div onClick={() => setEditMode(true)}>{escapedNewLineToLineBreakTag(value)}</div>
            }
        </div>
    )
}

function CSVInput(submit_run: (run_name: string, csv_string: string) => void, credit: number) {
    const [run_name, set_run_name] = React.useState('');
    const [csv_string, set_csv_string] = React.useState('index, prompt\n');
    const [credit_required, set_credit_required] = React.useState(0);
    const [csv_format_check, set_csv_format_check] = React.useState(false);
    const [csv_json, set_csv_json] = React.useState<ISong[]>([]);
    const [text_mode, set_text_mode] = React.useState(true);

    function check_credit(e: React.ChangeEvent<HTMLTextAreaElement>) {
        let csv_string = e.target.value;
        set_csv_string(csv_string);

        // 1. Read the CSV value
        csv().fromString(csv_string).then((json: ISong[]) => {
            // 2. Calculate the credit
            let credit_required = json.length * 10;

            set_credit_required(credit_required);

            // 3. Check if the format is correct
            let csv_format_check = json[0] && json[0].hasOwnProperty('index') && json[0].hasOwnProperty('prompt');
            set_csv_format_check(csv_format_check);

            set_csv_json(json);
        });
    }

    function CSVTable() {
        function edit_row(index: number, key: string, value: string) {
            // @ts-ignore
            csv_json[index][key] = value;
            set_csv_json(csv_json);
        }


        function Header(json: ISong[]) {
            return (
                <thead>
                    <tr>
                        {Object.keys(json[0]).map((key, index) => (
                            <th key={index} style={{ padding: '0 1rem' }}>{key}</th>
                        ))}
                    </tr>
                </thead>
            )
        }

        function Row(json: ISong, row_index: number) {
            return (
                <tr>
                    {Object.values(json).map((value, index) => (
                        console.log(index),
                        <td key={index}>{EditableText(value, e => edit_row(row_index, Object.keys(json)[index], e.target.value))}</td>
                    ))}
                </tr>
            )
        }

        return (
            <table style={{ overflowX: 'auto', whiteSpace: 'wrap' }}>
                {Header(csv_json)}
                {csv_json.map((row, index) => Row(row, index))}
            </table>
        )
    }

    function CSVToTable() {
        set_text_mode(false);
    }

    function TableToCSV() {
        set_csv_string(CSVFormatter(csv_json));
        set_text_mode(true);
    }

    return (
        <>
            {
                credit >= 0 && credit < credit_required ?
                    <div className="text-red-500">
                        {credit_required > 0 && `This run is going to cost you ${credit_required} credits.`}
                        You don't have enough credits for this run. Please wait for the next month or reduce prompt count.
                    </div>
                    :
                    <div className="text-red-500">
                        This run is going to cost you {credit_required} credits.
                    </div>
            }
            <div className="space-y-6 mt-10 sm:mx-auto sm:w-full">
                <div>
                    <label className='font-medium text-xl text-indigo-900 flex items-center gap-2' htmlFor="run_name">Run Title</label>
                    <div className='mt-2'>
                        <input name="run_name" value={run_name} onChange={e => set_run_name(e.target.value)} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"></input>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between">
                        <label className='font-medium text-xl text-indigo-900 flex items-center gap-2'>CSV Data</label>
                        <div className=' shrink-0 sm:flex sm:flex-col sm:items-end text-gray-500'> {!csv_format_check ? 'To Table' : text_mode ? <a onClick={CSVToTable} href='javascript:;'>To Table</a> : <a onClick={TableToCSV} href='javascript:;'>To Text</a>}</div>
                    </div>
                    {text_mode ?
                        <textarea onChange={check_credit} defaultValue={csv_string} rows={10} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"></textarea>
                        :
                        <CSVTable />
                    }
                </div>
                <button disabled={credit < credit_required || run_name.length == 0 || !csv_format_check} onClick={() => submit_run(run_name, csv_string)} className={((credit < credit_required || run_name.length == 0 || !csv_format_check) ? "cursor-not-allowed " : "") + "flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 "}>Submit</button>
            </div>
        </>
    )
}

export default function Batch() {
    const [real_run_name, set_real_run_name] = React.useState('');
    const [job_count, set_job_count] = React.useState(0);
    const [show_run_status, set_show_run_status] = React.useState(false);
    const [song_data, set_song_data] = React.useState(Array<ISong>());
    const [check_interval, set_check_interval] = React.useState<NodeJS.Timeout>();


    const [credit, set_credit] = React.useState(-1);
    const [total_credit, set_total_credit] = React.useState(0);
    const [credit_fetched, set_credit_fetched] = React.useState(false);

    const [prompt_data, set_prompt_data] = React.useState<Array<IGeneratePrompt>>([]);

    // Get the credit from the server
    React.useEffect(() => {
        axios.get('/api/get_limit').then(response => {
            set_credit(response.data['credits_left']);
            set_total_credit(response.data['monthly_limit']);
            set_credit_fetched(true);
        });
    }, []);

    async function submit_run(run_name: string, csv_string: string) {
        if (check_interval) {
            clearInterval(check_interval);
            set_check_interval(undefined);
        }
        
        const result = await axios.post('/api/batch_generate', {
            run_name, csv_string
        });

        set_real_run_name(result.data['run_name']);

        set_show_run_status(true);

        // Start an interval to check the run status

        const check_result = await axios.get(`/api/batch_status?run_name=${result.data['run_name']}`);
        const run_status: IRunStatus = check_result.data;

        set_prompt_data(run_status.prompts);

        set_job_count(run_status.remaining_count || 0);

        set_show_run_status(true);

        const csv = await axios.get(`/api/fetch_batch_song_data?run_name=${result.data['run_name']}`);
        set_song_data(csv.data);

        axios.get('/api/get_limit').then(response => {
            set_credit(response.data['credits_left']);
            set_total_credit(response.data['monthly_limit']);
            set_credit_fetched(true);
        });

        let interval = setInterval(async () => {
            const check_result = await axios.get(`/api/batch_status?run_name=${result.data['run_name']}`);
            const run_status: IRunStatus = check_result.data;

            set_prompt_data(run_status.prompts);

            if (run_status.ended) {
                set_job_count(0);
                clearInterval(interval);

                set_check_interval(undefined);
            } else {
                set_job_count(run_status.remaining_count || 0);
            }

            set_show_run_status(true);

            const csv = await axios.get(`/api/fetch_batch_song_data?run_name=${result.data['run_name']}`);
            set_song_data(csv.data);

            axios.get('/api/get_limit').then(response => {
                set_credit(response.data['credits_left']);
                set_total_credit(response.data['monthly_limit']);
                set_credit_fetched(true);
            });
        }, 1000);

        set_check_interval(interval);
    }

    return (
        <>
            <section className="mx-auto w-full px-4 lg:px-0" >
                <div className="mx-auto">
                    <article className="prose lg:prose-l gt-10" style={{ maxWidth: '100%', paddingLeft: '5rem', paddingRight: '5rem', marginTop: '1rem', marginBottom: '2rem' }}>
                        <h1 className=' text-center text-indigo-900'>
                            Batch Downloader
                        </h1>
                        <div className="text-gray-500">
                            Current Credit: {credit_fetched ? (credit + '/' + total_credit) : 'loading...'}
                        </div>
                        {CSVInput(submit_run, credit)}
                        {show_run_status &&
                            <div className="text-gray-500">
                                Run {real_run_name}, {job_count} jobs left. {job_count === 0 ? 'Run finished.' : ''}
                            </div>}
                        <Kanban prompts={prompt_data} songs={song_data}></Kanban>
                    </article>
                </div>
            </section>
        </>
    )
}