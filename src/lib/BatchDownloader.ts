import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import csv from "csvtojson";
import fs from "fs";
import https from "https";

const MAX_WORKER_COUNT = 4;

interface IGeneratePrompt {
    run_name: string,
    index: string,
    prompt: string,
    lyrics?: string,
    make_instrumental?: Boolean,
    model?: string,
}

interface IRunStatus {
    run_name: string,
    ended: boolean,
    remaining_count?: number,
}

interface IRun {
    run_name: string,
    audio_folder: string,
    csv_file: string
}

function getExt(url: string) {
    const index = url.lastIndexOf('.')
    const ext = url.substring(index, url.length)
    if (ext === '.') {
        return '.mp3'
    } else {
        return ext
    }
}

class CSVWriter {
    private fd: number;
    private header: Array<string> = [];

    constructor(filename: string, append = false) {
        if (fs.existsSync(filename) && append) {
            // TODO: Consider the append case
            throw 'Unimplemented'
        } else {
            try {
                this.fd = fs.openSync(filename, 'w')
            } catch (e) {
                console.error(`Cannot Open CSV file ${filename} for write.`)
                throw e
            }
        }
    }

    _preprocess(item: any) {
        let stgItem = '';
        if (typeof item === 'object') {
            if (item === null) {
                stgItem = 'null';
            } else {
                stgItem = JSON.stringify(item);
            }
        } else {
            stgItem = item.toString();
        }
        let needEscape = false;
        if (stgItem.indexOf('\n') !== -1 || stgItem.indexOf(',') !== -1) {
            needEscape = true;
        }
        if (stgItem.indexOf('"') !== -1) {
            stgItem = stgItem.replace(/"/g, '""')
            needEscape = true;
        }
        if (needEscape) {
            return `"${stgItem}"`
        } else {
            return stgItem
        }

    }

    async writeArray(arr: Array<any>) {
        if (!this.header) throw 'Header not yet set'

        // 1. Format Array into sting
        let line = this._preprocess(arr[0])
        for (let i = 1; i < arr.length; i++) {
            line += `,${this._preprocess(arr[i])}`
        }
        line += '\n'

        // 2. Write
        await new Promise((resolve, reject) => {
            fs.write(this.fd, line, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(undefined)
                }
            })
        })
    }

    async writeObjectLine(obj: any) {
        if (this.header.length == 0) {
            const header = []
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    header.push(key)
                }
            }
            await this.setHeader(header)
        }

        // Write each key in header order
        let line = this._preprocess(obj[this.header[0]])
        for (let i = 1; i < this.header.length; i++) {
            line += `,${this._preprocess(obj[this.header[i]])}`
        }
        line += '\n';

        // Write
        await new Promise((resolve, reject) => {
            fs.write(this.fd, line, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(undefined)
                }
            })
        })
    }

    async setHeader(header: Array<string>) {
        if (this.header.length != 0) throw 'Header Already Set'
        this.header = header;
        await this.writeArray(header)
    }

    async writeObject(obj: any) {
        if (this.header.length == 0) {
            const header = []
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    header.push(key)
                }
            }
            await this.setHeader(header)
        }
        const arr = new Array(this.header.length);
        for (let i = 0; i < this.header.length; i++) {
            if (this.header[i].indexOf('.') !== -1) {
                let seg = obj;
                for (const part of this.header[i].split('.')) {
                    if (seg === undefined || seg === null || !seg.hasOwnProperty(part)) {
                        seg = undefined
                        break;
                    }
                    seg = seg[part];
                }
                if (seg === undefined) {
                    arr[i] = '';
                } else {
                    arr[i] = seg;
                }
            } else {
                arr[i] = obj[this.header[i]];
                if (arr[i] === undefined) {
                    arr[i] = '';
                }
            }
        }
        await this.writeArray(arr)
    }

    async writeList(list: Array<any>) {
        for (const object of list) {
            await this.writeObject(object);
        }
    }

    disconnect() {
        fs.closeSync(this.fd)
    }
}

class Downloader {
    private queue: Array<IGeneratePrompt> = [];
    private run_counts: Map<string, number> = new Map();
    private run_csvs: Map<string, CSVWriter> = new Map();

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
            const csv_writer = this.run_csvs.get(run_name);
            if (!csv_writer) throw 'Impossible';

            if (content[0].status === 'error') {
                for (let i = 0; i < content.length; i++) {
                    await csv_writer.writeObjectLine({
                        index: item.index,
                        cnt: i,
                        title: content[i]["title"],
                        file_name: "",
                        lyrics: content[i]["lyric"],
                        song_id: content[i]["id"],
                        audio_url: content[i]["audio_url"],
                        error: content[0].error_message
                    });
                }

                await new Promise(res => setTimeout(res, 1000));
                console.log(`[Worker ${id}] ${item.index} Error`);

                const remaining_count = this.run_counts.get(run_name) || 1;
                if (remaining_count == 1) {
                    this.run_counts.delete(run_name);
                    this.run_csvs.get(run_name)?.disconnect();
                    this.run_csvs.delete(run_name);

                    console.log(`[Worker ${id}] Run ${run_name} Done`);
                } else {
                    this.run_counts.set(run_name, remaining_count - 1);
                }
                continue;
            }
            console.log(`[Worker ${id}] ${item.index} Generated`);

            // 6. Download Audio and Record to CSV
            let download_promises = [];
            for (let i = 0; i < content.length; i++) {
                const audio_url = content[i]["audio_url"] || "";
                const file_name = `${item.index}-${i}.mp3`;

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
                    return csv_writer.writeObjectLine({
                        index: item.index,
                        cnt: i,
                        title: content[i]["title"],
                        file_name: file_name,
                        lyrics: content[i]["lyric"],
                        song_id: content[i]["id"],
                        audio_url: audio_url,
                        error: ""
                    })
                }).then(() => {
                    console.log(`[Worker ${id}] Download: ${item.index} - ${i} Done`)
                }).catch((e) => {
                    console.error(`[Worker ${id}] Download: ${item.index} - ${i} Failed log dump`);
                    // Write to log
                    fs.appendFileSync('./src/resources/downloads/download/download_error.txt', `${item.index} - ${i} ${content[i]["title"]}\n${e.toString()}, id: ${content[i]["song_id"]}\n`);


                    return csv_writer.writeObjectLine({
                        index: item.index,
                        cnt: i,
                        title: content[i]["title"],
                        file_name: "",
                        lyrics: content[i]["lyric"],
                        song_id: content[i]["id"],
                        audio_url: audio_url,
                        error: ""
                    })
                }));
            }

            await Promise.allSettled(download_promises);

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
            
            console.log(`[Worker ${id}] ${item.index} Done`);

            const remaining_count = this.run_counts.get(run_name) || 1;
            if (remaining_count == 1) {
                this.run_counts.delete(run_name);
                this.run_csvs.get(run_name)?.disconnect();
                this.run_csvs.delete(run_name);

                console.log(`[Worker ${id}] Run ${run_name} Done`);
            } else {
                this.run_counts.set(run_name, remaining_count - 1);
            }

            
        }
    }

    constructor() {
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

        // 3. Create items in maps
        this.run_counts.set(run_name, queue.length);
        this.run_csvs.set(run_name, new CSVWriter(`./src/resources/downloads/${run_name}.csv`));

        const run: IRun = {
            run_name,
            audio_folder: `./src/resources/downloads/download-${run_name}`,
            csv_file: `./src/resources/downloads/${run_name}.csv`
        }

        return run;
    }

    async check_run_status(run_name: string) {
        if (!this.run_counts.has(run_name)) {
            return {
                run_name,
                ended: true
            }
        } else {
            return {
                run_name,
                ended: false,
                remaining_count: this.run_counts.get(run_name)
            }
        }
    }

    async get_all_running_jobs() {
        const result: Array<IRunStatus> = [];
        this.run_counts.forEach((value, key) => {
            result.push({
                run_name: key,
                ended: false,
                remaining_count: value
            })
        });
        return result;
    }
}

export const downloader = new Downloader();