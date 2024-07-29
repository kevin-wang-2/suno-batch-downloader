import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import csv from "csvtojson";
import { CSVFormatter } from "./CSVFormatter";
import fs from "fs";
import https from "https";
import { IGeneratePrompt, IRunStatus, IRun, ISong } from "@/lib/BatchDownloaderUtils";

const MAX_WORKER_COUNT = 4;

function getExt(url: string) {
    const index = url.lastIndexOf('.')
    const ext = url.substring(index, url.length)
    if (ext === '.') {
        return '.mp3'
    } else {
        return ext
    }
}

class Downloader {
    private queue: Array<IGeneratePrompt> = [];

    private run_song_data: Map<string, Array<ISong>> = new Map();
    private run_info: Map<string, IRunStatus> = new Map();

    insert_song(song_info: ISong, run_name: string) {
        if (!this.run_song_data.has(run_name) || !this.run_info.has(run_name)) {
            throw 'Run Not Found';
        }
        this.run_song_data.get(run_name)?.push(song_info);
        return this.run_song_data.get(run_name)?.length || 1 - 1;
    }

    song_generation_update(song_index: number, run_name: string, status: number, song_info?: ISong) {
        if (!this.run_song_data.has(run_name)) {
            throw 'Run Not Found';
        }
        const run_song_list = this.run_song_data.get(run_name);
        if (!run_song_list) {
            throw 'Run Not Found';
        }
        if (song_info) {
            run_song_list[song_index] = song_info;
        }
        run_song_list[song_index].status = status;
    }

    download_finished(run_name: string) {
        const run_info = this.run_info.get(run_name);
        if (!run_info) {
            throw 'Run Not Found';
        }
        const remaining_count = run_info?.remaining_count || 1;
        if (remaining_count === 1) {
            run_info.remaining_count = 0;
            run_info.ended = true;
            return true;
        } else {
            run_info.remaining_count = remaining_count - 1;
            return false;
        }
    }

    async worker(id: number) {
        while (1) {
            // 1. Yield
            await new Promise(res => setTimeout(res));

            // 2. Check if we have any jobs in the queue
            if (this.queue.length == 0) {
                continue;
            }

            // 3. Fetch the first job in the queue
            const item = this.queue.shift();
            if (!item) {
                throw 'Impossible'
            }

            item.status = 0;
            const run_name = item.run_name;

            // 4. Start generating this job
            let content: any;
            try {
                if (item.lyrics) {
                    content = await (await sunoApi).custom_generate(
                        item.lyrics,
                        item.prompt,
                        item.index,
                        Boolean(item.make_instrumental),
                        item.model || DEFAULT_MODEL,
                        true
                    );
                } else {
                    content = await (await sunoApi).generate(
                        item.prompt,
                        Boolean(item.make_instrumental),
                        item.model || DEFAULT_MODEL,
                        true
                    );
                }
            } catch (e: any) {
                // Push item back to queue
                this.queue.push(item);
                console.error(`[Worker ${id}] Generation request ended with error ${e['response']['data']} pushed job back to queue`);

                await new Promise(res => setTimeout(res, 1000));
                continue;
            }

            // 5. Handle generation error

            if (content[0].status === 'error') {
                for (let i = 0; i < content.length; i++) {
                    this.insert_song({
                        index: item.index,
                        cnt: i,
                        title: content[i]["title"],
                        lyrics: content[i]["lyric"],
                        song_id: content[i]["id"],
                        audio_url: content[i]["audio_url"],
                        error: "Generation Error: " + content[i]["error_message"] || "",
                        status: -1
                    }, run_name);
                }

                await new Promise(res => setTimeout(res, 1000));
                console.log(`[Worker ${id}] ${item.index} Error`);

                item.status = -1;
                this.download_finished(run_name);

                continue;
            } else {
                item.status = 1;
            }
            console.log(`[Worker ${id}] ${item.index} Generated`);

            // 6. Download Audio and Record to CSV
            let download_promises = [];
            for (let i = 0; i < content.length; i++) {
                const audio_url = content[i]["audio_url"] || "";
                const file_name = `${item.index}-${i}.mp3`;
                const song = {
                    index: item.index,
                    cnt: i,
                    title: content[i]["title"],
                    lyrics: content[i]["lyric"],
                    song_id: content[i]["id"],
                    audio_url: audio_url,
                    error: "",
                    status: 1
                }

                const song_index = this.insert_song(song, run_name);

                console.log(`[Worker ${id}] Download: ${item.index} - ${i} Start`)

                download_promises.push((new Promise((resolve, reject) => {
                    const file = fs.createWriteStream(`./src/resources/downloads/download-${run_name}/${file_name}`);
                    const request = https.get(audio_url, response => {
                        response.pipe(file);

                        file.on("finish", () => {
                            resolve(undefined)
                        });

                        file.on("error", (err) => {
                            reject(err)
                        }).on("error", (err) => {
                            reject(err)
                        });
                    })
                })).then(() => {
                    song.status = 2;
                    console.log(`[Worker ${id}] Download: ${item.index} - ${i} Done`)
                }).catch((e) => {
                    console.error(`[Worker ${id}] Download: ${item.index} - ${i} Failed log dump`);
                    // Write to log
                    fs.appendFileSync('./src/resources/downloads/download/download_error.txt', `${item.index} - ${i} ${content[i]["title"]}\n${e.toString()}, id: ${content[i]["song_id"]}\n`);
                    song.status = -1;
                    song.error = 'Download Error: ' + e.toString();
                }));
            }

            await Promise.allSettled(download_promises);
            item.status = 2;

            // 7. Wait till status becomes complete
            while (1) {
                if (content.every((item: any) => item.status === 'complete')) {
                    break;
                }

                try {
                    content = await (await sunoApi).get(content.map((item: any) => item.id));
                    await new Promise(res => setTimeout(res, 1000));
                } catch (e) {
                    continue;
                }
            }
            item.status = 3;
            
            console.log(`[Worker ${id}] ${item.index} Done`);

            this.download_finished(run_name);
        }
    }

    constructor() {
        console.log('Downloader Started');
        for (let i = 0; i < MAX_WORKER_COUNT; i++) {
            this.worker(i);
        }
    }

    async start_run(run_name: string, csv_string: string) {
        // 1. Unique run name and create folder
        let i = 0;
        while (fs.existsSync(`./src/resources/downloads/download-${run_name}-${i}`)) {
            i++;
        }
        fs.mkdirSync(`./src/resources/downloads/download-${run_name}-${i}`);
        run_name = `${run_name}-${i}`;

        // 2. Parse CSV
        const queue = await csv().fromString(csv_string);
        for (const item of queue) {
            item.run_name = run_name;
        }
        this.queue = this.queue.concat(queue);

        queue.forEach((item) => {
            item.status = 4;
        });

        // 3. Create items in maps

        this.run_info.set(run_name, {
            run_name,
            ended: false,
            remaining_count: queue.length,
            prompts: queue
        });
        this.run_song_data.set(run_name, []);

        const run: IRun = {
            run_name,
            audio_folder: `./src/resources/downloads/download-${run_name}`,
            csv_file: `./src/resources/downloads/${run_name}.csv`
        }
        return run;
    }

    async check_run_status(run_name: string) {
        if (!this.run_info.has(run_name)) {
            throw 'Run Not Found';
        }
        return this.run_info.get(run_name);
    }

    async get_all_running_jobs() {
        return Array.from(this.run_info.values());
    }

    get_run_csv(run_name: string) {
        // 1. Write to CSV
        const csv_text = CSVFormatter(this.run_song_data.get(run_name) || []);
        fs.writeFileSync(`./src/resources/downloads/${run_name}.csv`, csv_text);
        return `./src/resources/downloads/${run_name}.csv`
    }

    get_run_song_data(run_name: string) {
        if (!this.run_song_data.has(run_name)) {
            throw 'Run Not Found';
        }
        return this.run_song_data.get(run_name) || [];
    }

    get_run_prompt_status(run_name: string) {
        if (!this.run_info.has(run_name)) {
            throw 'Run Not Found';
        }
        return this.run_info.get(run_name)?.prompts;
    }

    get_audio_folder(run_name: string) {
        return `./src/resources/downloads/download-${run_name}`
    }
}

let downloader_instance: Downloader;

if (process.env.NODE_ENV === 'production') {
    downloader_instance = new Downloader();
} else {
    // Check global 
    // @ts-ignore
    if (!global.downloader_instance) {
        // @ts-ignore
        global.downloader_instance = new Downloader();
    }
    // @ts-ignore
    downloader_instance = global.downloader_instance;
}

export const downloader = () => downloader_instance;