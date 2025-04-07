/// <reference lib="webworker" />

let videoFeeder!:VideoFeeder;
addEventListener('message', ({data}) => {
    if(data.url) {
        videoFeeder = new VideoFeeder(data.url)
        videoFeeder.setUpWebsocketConnection();
        videoFeeder.setupDecoder();
    }
    else if(data.close && videoFeeder) {
        videoFeeder.close()
    }
});

class VideoFeeder {
    decoder!: VideoDecoder;
    firstKeyFrameReceived: boolean = false;
    buffer = new Uint8Array();

    largeBuffers: Uint8Array[] = [];
    bufferInUse = false;
    timeout!: NodeJS.Timeout;
    url!: string;
    ws!: WebSocket;
    
    constructor(url: string) {
        this.url = url;
    }

    setupDecoder(): void {
        this.firstKeyFrameReceived = false;
        this.decoder = new VideoDecoder({
            output: async (frame) => {
                postMessage(frame);
                frame.close();
            },
            error: (e) => {
                console.warn("Video decoder:" + e.message);
                this.setupDecoder();
            },
        });
    }

    isHEVC: boolean = false;
    started = false;
    codec = ""; // https://wiki.whatwg.org/wiki/Video_type_parameters

    processMessage = async (data: Uint8Array): Promise<void> => {
        // let processStart = performance.now();
        if (this.decoder.state !== "configured") {
            const config = {codec: this.codec, optimizeForLatency: true};
            this.decoder.configure(config);
        }
        const chunk = new EncodedVideoChunk({
            timestamp: (performance.now()) * 1000,
            type: (this.isHEVC ? (data[3] === 0x40) : ((data[4] & 0x0f) === 7)) ? "key" : "delta",
            data: data,
        });
        this.decoder.decode(chunk);
        // console.log("process time: "+(performance.now()-processStart))
    }

    setUpWebsocketConnection() {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onmessage = (event: MessageEvent) => {
            if (!this.started) {
                let array = new Uint8Array(event.data)
                if (array[0] === 9) {
                    let decoded_arr = array.slice(1);
                    this.codec = this.Utf8ArrayToStr(decoded_arr);
                    console.log('first packet with codec data: ' + this.codec);
                    this.started = true;
                } else
                    console.error("No codec was found")
            } else {
                this.processChunk(event.data).then();
            }
        };

        this.ws.onerror = (ev) => {
            console.error("An error occurred with the video feeder websocket connection")
        }

        this.ws.onclose = (ev) => {
            postMessage({closed: true})
            console.info("The video feed websocket was closed: " + ev.reason)
        }

        this.timeout = setTimeout(() => {
            this.timeoutRestart();
        }, 6000)

    }
    close() {
        this.ws.close()
    }
    resetTimeout() {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.timeoutRestart();
        }, 6000)
    }

    timeoutRestart() {
        console.error("Video feed from websocket has stopped, restarting ...");
        this.setUpWebsocketConnection();
    }

    async putLargeFrames(): Promise<void> {
        if (this.largeBuffers.length > 0) {
            let totalLength = 0;
            this.largeBuffers.forEach((element: Uint8Array) => {
                totalLength += element.length;
            });
            let offset = 0;
            const mergedArray = new Uint8Array(totalLength);
            this.largeBuffers.forEach((element: Uint8Array) => {
                mergedArray.set(element, offset);
                offset += element.length;
            });
            this.largeBuffers = [];
            await this.processMessage(mergedArray);
        }
    }

    async processChunk(value: ArrayBuffer): Promise<void> {
        //  let processChunkStart = performance.now();
        this.resetTimeout();
        this.buffer = new Uint8Array(value);
        const i = 0
        const isStartFrame = (this.buffer[i] === 0 && this.buffer[i + 1] === 0 && this.buffer[i + 2] === 0 && this.buffer[i + 3] === 1) ||  // TODO: handle 4 preceding zeros
            (this.buffer[0] === 0 && this.buffer[1] === 0 && this.buffer[2] === 1);  // TODO: make sure there are no addition hevc header specs to handle.
        this.isHEVC = this.buffer[2] === 1;  // TODO: Ensure I'm using a definitive test for HEVC

        const isKeyFrame = !this.isHEVC ? isStartFrame && (((this.buffer[i + 4] & 0x07) === 7)) : this.buffer[3] === 0x40;  // TODO: check this thoroughly

        if (isKeyFrame)
            this.firstKeyFrameReceived = true;
        if (this.firstKeyFrameReceived) {
            if (isStartFrame && this.bufferInUse) {
                await this.putLargeFrames();
                this.bufferInUse = false;
            }
            // If the length is the maximum packet size, put into the large buffers array to append
            //  together for processing by the decoder
            if (value.byteLength >= 32767)
                this.bufferInUse = true;
            if (this.bufferInUse) {
                this.largeBuffers.push(this.buffer);
            } else if (isStartFrame)
                await this.processMessage(this.buffer);
            else
                console.error("Video processing: malformed message received")
        }
    }

    Utf8ArrayToStr(array: Uint8Array): string {
        let out, i, len;
        out = '';
        len = array.length;
        i = 0;
        while (i < len) {
            out += String.fromCharCode(array[i]);
            ++i;
        }
        return out;
    }
}
