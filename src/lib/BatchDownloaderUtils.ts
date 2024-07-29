export interface IGeneratePrompt {
    run_name: string,
    index: string,
    prompt: string,
    lyrics?: string,
    make_instrumental?: Boolean,
    model?: string,
    status?: number
}

export interface IRunStatus {
    run_name: string,
    ended: boolean,
    remaining_count?: number,
    prompts: Array<IGeneratePrompt>
}

export interface IRun {
    run_name: string,
    audio_folder: string,
    csv_file: string
}

export interface ISong {
    index: string,
    cnt: number,
    title: string,
    lyrics: string,
    song_id: string,
    audio_url: string,
    error: string,
    status: number
}

export const statusMap = (status: number) => {
    switch (status) {
        case 0:
            return 'Generating';
        case 1:
            return 'Downloading';
        case 2:
            return 'Downloaded';
        case 3:
            return 'Complete';
        case 4:
            return 'Waiting';
        case -1:
            return 'Error';
        default:
            return 'Unknown';
    }
}