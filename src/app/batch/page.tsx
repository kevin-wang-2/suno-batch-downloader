'use client'
import React from 'react';
import Section from '../components/Section';
import Markdown from 'react-markdown';

import axios from 'axios';
import { isNull } from 'util';

const MAX_WORKER = 2;



export default function Batch() {
    const [run_name, set_run_name] = React.useState('');
    const [csv_string, set_csv_string] = React.useState('');

    function submit_run() {
        axios.post('/api/batch_generate', {
            run_name, csv_string
        })
    }

    return (
        <>
            <Section className="my-10">
                <article className="prose lg:prose-lg max-w-3xl pt-10">
                    <h1 className=' text-center text-indigo-900'>
                        Batch Downloader
                    </h1>
                    <input value={run_name} onChange={e => set_run_name(e.target.value)}></input>
                    <textarea onChange={e => set_csv_string(e.target.value)} defaultValue={csv_string}></textarea>
                    <button onClick={submit_run}>提交</button>
                </article>
            </Section>
        </>
    )
}