'use client'
import React from 'react';

import axios from 'axios';
import { IRunStatus, IGeneratePrompt, ISong, statusMap } from '@/lib/BatchDownloaderUtils';
import Kanban from '@/app/components/batch/Kanban';

function LazyLoadKanban({ run }: { run: IRunStatus }) {
    const [songs, setSongs] = React.useState<ISong[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);

    React.useEffect(() => {
        if (run.ended) {
            axios.get(`/api/fetch_batch_song_data?run_name=${run.run_name}`)
                .then(res => {
                    setSongs(res.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                });
        } else {
            const interval = setInterval(() => {
                axios.get(`/api/fetch_batch_song_data?run_name=${run.run_name}`)
                    .then(res => {
                        setSongs(res.data);
                        setLoading(false);
                    })
                    .catch(err => {
                        console.error(err);
                    });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [run.run_name]);

    return <Kanban prompts={run.prompts} songs={songs} show_loading={[false, false, loading]} />;
}

function RunInfo({ run }: { run: IRunStatus }) {
    const [show, setShow] = React.useState<boolean>(false);

    return (
        <div className="flex flex-col">
            <div className="flex flex-row justify-between">
                <div className="text-lg font-semibold cursor-pointer flex-col jusity-between inline-block" onClick={() => { setShow(show => !show) }}>
                    {run.run_name}
                    <svg className="w-2.5 h-2.5 inline-block mx-1" fill="none" viewBox="0 0 10 6" style={{ transform: show ? 'scale(-1, -1)' : '' }}>
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4" />
                    </svg>
                </div>

                <div className="flex justify-end">
                    <div className="flex flex-row">
                        <div className="flex-col justify-end">
                            <div className="text-sm font-semibold">Status</div>
                            <div className="text-sm font-semibold">Remaining</div>
                        </div>
                        <div className="flex-col justify-end w-10 mx-5">
                            <div className="text-sm">{run.ended ? 'Ended' : 'Running'}</div>
                            <div className="text-sm">{run.remaining_count}</div>
                        </div>
                    </div>

                </div>
                <div className="flex flex-col justify-end">
                    <a href={`/api/download_zip?run_name=${run.run_name}`}><b>Download ZIP</b></a>
                </div>
            </div>
            {show &&
                <>
                    <hr className="h-px my-8 bg-gray-200 border-0"></hr>
                    <LazyLoadKanban run={run} />
                </>
            }
            <hr className="h-px my-8 bg-gray-200 border-0 dark:bg-gray-700"></hr>
        </div>
    );

}

export default function RunPage() {
    const [runs, setRuns] = React.useState<IRunStatus[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);

    React.useEffect(() => {
        const interval = setInterval(() => {
            axios.get('/api/batch_status')
                .then(res => {
                    setRuns(res.data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }, 1000);
        return () => clearInterval(interval);
    }, []);


    return (
        <>
            <section className="mx-auto w-full px-4 lg:px-0" >
                <div className="mx-auto">
                    <article className="prose lg:prose-l gt-10" style={{ maxWidth: '100%', paddingLeft: '5rem', paddingRight: '5rem', marginTop: '1rem', marginBottom: '2rem' }}>
                        <h1 className=' text-center text-indigo-900'>
                            Batch Run Status
                        </h1>
                        <div className="flex flex-col">
                            {loading ? <div className="text-center"><svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 inline-block mx-2" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                            </svg>
                                Loading...</div> : runs.map(run => (
                                    <RunInfo key={run.run_name} run={run} />
                                ))}
                        </div>
                    </article>
                </div>
            </section>
        </>
    );
}