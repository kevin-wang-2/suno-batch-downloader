import React from 'react';
import { statusMap, ISong, IGeneratePrompt } from '@/lib/BatchDownloaderUtils';

const escapedNewLineToLineBreakTag = (string: string) => string.split('\n').map((item, index) => (index === 0) ? item : [<br key={index} />, item])

function SongInfoTablePopup({ songs, onClose }: { songs: ISong[], onClose: () => void }) {
    return (
        <div className="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-800 bg-opacity-50">
            <div className="bg-white p-4 w-1/2 mx-auto my-10 rounded-lg">
                <div className="flex justify-between">
                    <h1 className="text-xl font-semibold">All Songs</h1>
                    <button onClick={onClose} className="text-red-500">Close</button>
                </div>
                <div className="text-gray-500">
                    {songs.length === 0 ? 'There are no generated songs.' :
                        <table style={{ overflowX: 'auto', whiteSpace: 'wrap' }}>
                            <thead>
                                <tr>
                                    <th>Index</th>
                                    <th>Title</th>
                                    <th>Lyrics</th>
                                    <th>Status</th>
                                    <th>Stream</th>
                                </tr>
                            </thead>
                            {songs.map((row, index) => {
                                if (row['status'] === -1) {
                                    // Combine Lyrics, Stream, Download to show error message
                                    return (
                                        <tr key={index} style={{ borderBottom: '1px solid black', textAlign: 'center' }}>
                                            <td>{row['index']}-{row['cnt']}</td>
                                            <td>{row['song_id']}</td>
                                            <td>{row['error']}</td>
                                            <td>{statusMap(row['status'])}</td>
                                            <td><a href={row['audio_url']} download>Stream</a></td>
                                            <td><a href={row['audio_url']} download>Download</a></td>
                                        </tr>
                                    )
                                } else {
                                    return (
                                        <tr key={index} style={{ borderBottom: '1px solid black' }}>
                                            <td>{row['index']}-{row['cnt']}</td>
                                            <td>{row['title']}</td>
                                            <td>{escapedNewLineToLineBreakTag(row['lyrics'])}</td>
                                            <td>{statusMap(row['status'])}</td>
                                            <td><a href={row['audio_url']} download>Stream</a></td>
                                        </tr>
                                    )
                                }
                            })
                            }
                        </table>
                    }
                </div>
            </div>
        </div>
    );
}

function SongInfoPopup({ song, onClose }: { song?: ISong, onClose: () => void }) {
    if (!song) {
        return null;
    }
    return (
        <div className="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-800 bg-opacity-50">
            <div className="bg-white p-4 w-1/2 mx-auto my-10 rounded-lg">
                <div className="flex justify-between">
                    <h1 className="text-xl font-semibold"><b>Song: </b>{song.title || song.index}</h1>
                    <button onClick={onClose} className="text-red-500">Close</button>
                </div>
                <div className="text-gray-500">
                    <div>Index: {song.index}-{song.cnt}</div>
                    <div>Title: {song.title}</div>
                    <div>Lyrics: {escapedNewLineToLineBreakTag(song.lyrics)}</div>
                    <div>Status: {statusMap(song.status)}</div>
                    {song.status == -1 && <div>{song.error}</div>}
                    <div>Stream: <a href={song.audio_url} download>Stream</a></div>
                </div>
            </div>
        </div>
    );
}

function PromptInfoPopup({ prompt, onClose }: { prompt?: IGeneratePrompt, onClose: () => void }) {
    if (!prompt) {
        return null;
    }
    return (
        <div className="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-[calc(100%-1rem)] max-h-full bg-gray-800 bg-opacity-50">
            <div className="bg-white p-4 w-1/2 mx-auto my-10 rounded-lg">
                <div className="flex justify-between">
                    <h1 className="text-xl font-semibold"><b>Prompt: </b>{prompt.run_name}-{prompt.index}</h1>
                    <button onClick={onClose} className="text-red-500">Close</button>
                </div>
                <div className="text-gray-500">
                    <div>Run Name: {prompt.run_name}</div>
                    <div>Index: {prompt.index}</div>
                    <div>Prompt: {prompt.prompt}</div>
                    <div>Lyrics: {prompt.lyrics}</div>
                    <div>Make Instrumental: {prompt.make_instrumental ? 'Yes' : 'No'}</div>
                    <div>Model: {prompt.model}</div>
                    <div>Status: {statusMap(prompt.status || 4)}</div>
                </div>
            </div>
        </div>
    );
}

export default function Kanban({ prompts, songs, show_loading }: { prompts: IGeneratePrompt[], songs: ISong[], show_loading?: [boolean, boolean, boolean] }) {
    const [showSingleSongPopup, setShowSingleSongPopup] = React.useState(false);
    const [showSinglePromptPopup, setShowSinglePromptPopup] = React.useState(false);
    const [showSongTablePopup, setShowSongTablePopup] = React.useState(false);
    const [selectedPrompt, setSelectedPrompt] = React.useState<IGeneratePrompt>();
    const [selectedSong, setSelectedSong] = React.useState<ISong>();

    function songStatusColorMap(status: number) {
        switch (status) {
            case 0:
                return 'bg-yellow-200';
            case 1:
                return 'bg-yellow-400';
            case 2:
                return 'bg-green-400';
            case 3:
                return 'bg-green-400';
            case 4:
                return 'bg-blue-200';
            case -1:
                return 'bg-red-400';
            default:
                return 'bg-gray-200';
        }
    }

    return (
        <>
            {showSingleSongPopup && (<SongInfoPopup song={selectedSong} onClose={() => setShowSingleSongPopup(false)}></SongInfoPopup>)}
            {showSongTablePopup && (<SongInfoTablePopup songs={songs} onClose={() => setShowSongTablePopup(false)}></SongInfoTablePopup>)}
            {showSinglePromptPopup && (<PromptInfoPopup prompt={selectedPrompt} onClose={() => setShowSinglePromptPopup(false)}></PromptInfoPopup>)}
            <div className="flex justify-between">
                <div style={{ width: '30%' }}>
                    <h3 className='text-center'>Prompts</h3>
                    {show_loading && show_loading[0] ? <div className='text-center text-gray-300'><svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 inline-block mx-2" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                            </svg>
                                Loading...</div> : prompts.filter(prompt => prompt.status == 4).map((prompt, index) => (
                        <div key={index} className='border-2 border-gray-300 p-2 m-2 cursor-pointer rounded-md truncate' onClick={() => {
                            setSelectedPrompt(prompt);
                            setShowSinglePromptPopup(true);
                        }}>
                            <div>Run Name: {prompt.run_name}</div>
                            <div>Index: {prompt.index}</div>
                        </div>
                    ))}
                </div>
                <div style={{ width: '30%' }}>
                    <h3 className='text-center'>Running Job</h3>
                    {show_loading && show_loading[1] ? <div className='text-center text-gray-300'><svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 inline-block mx-2" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                            </svg>
                                Loading...</div> : prompts.filter(prompt => prompt.status == 0 || prompt.status == 1).map((prompt, index) => (
                        <div key={index} className='border-2 border-gray-300 p-2 m-2 cursor-pointer rounded-md truncate' onClick={() => {
                            setSelectedPrompt(prompt);
                            setShowSinglePromptPopup(true);
                        }}>
                            <div>Run Name: {prompt.run_name}</div>
                            <div>Index: {prompt.index}</div>
                        </div>
                    ))}
                </div>
                <div style={{ width: '30%' }} className=' items-center'>
                    <h3 className='text-center' onClick={() => { setShowSongTablePopup(true) }}><a href="javascript:;">Songs</a></h3>
                    {show_loading && show_loading[2] ? <div className='text-center text-gray-300 items-center'><svg aria-hidden="true" className="w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 inline-block mx-2" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                            </svg>
                                Loading...</div> : songs.map((song, index) => (
                            <div key={index} className={'border-2 border-gray-300 p-2 m-2 cursor-pointer rounded-md truncate ' + songStatusColorMap(song.status)} onClick={() => {
                                setSelectedSong(song);
                                setShowSingleSongPopup(true);
                            }}>
                                <div>Index: {song.index}-{song.cnt}</div>
                                <div>Title: {song.title || "No Title"}</div>
                            </div>
                        ))}
                </div>
            </div>
        </>
    )
}