import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';

/*
    Use adts as container for audio ?
 */
@Component({
    selector: 'app-h264',
    standalone: true,
    imports: [],
    templateUrl: './h264.component.html',
    styleUrl: './h264.component.css'
})
export class H264Component implements OnInit, AfterViewInit{
    @ViewChild("startButton") fileEL!: ElementRef<HTMLInputElement>;
    @ViewChild("video") videoEL!: ElementRef<HTMLVideoElement>;

    file!: HTMLInputElement;
    video!: HTMLVideoElement;
    ws!: WebSocket;

    // @ts-ignore (MediaStreamTrackGenerator not in lib.dom.d.ts for some reason)
    readonly trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    readonly defaultWriter = this.trackGenerator.writable.getWriter();

    readonly decoder = new VideoDecoder({
        output: async (frame) => {
            await this.defaultWriter.write(frame);
            frame.close();
            await this.defaultWriter.ready;
           // this.defaultWriter.releaseLock();
        },
        error: (e) => console.warn(e.message),
    });

    process = async (data: Uint8Array): Promise<void> => {

        if (this.decoder.state !== "configured") {
            const config = {codec: "avc1.4d002a", optimizeForLatency: true};
            this.decoder.configure(config);
        }
        const chunk = new EncodedVideoChunk({
            timestamp: (performance.now() + performance.timeOrigin) * 1000,
            type: (data[4] & 0x0f) === 7 ? "key" : "delta",
            data,
        });
        this.decoder.decode(chunk);
    }

    async start(): Promise<void> {
        const process = this.process;
        this.video.srcObject = new MediaStream([this.trackGenerator])
        this.video.onloadedmetadata = () => {
            this.video.play().then();
        }

        this.ws = new WebSocket("/ws/stream?suuid=stream1");
        this.ws.binaryType = 'arraybuffer';
        this.ws.onmessage = (event: MessageEvent) => {
            processChunk(event.data);
        };

        let buffer = new Uint8Array();

        let keyFrameReceived: boolean = false;
        let keyFrameBuffers: Uint8Array[] = [];

        // @ts-ignore
        async function processChunk(value: ArrayBuffer): Promise<void> {
            buffer = new Uint8Array(value);
            const i = 0
            const isStartFrame = (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1);
            const isKeyFrame = isStartFrame && (((buffer[i + 4] & 0x07) === 7));
            if (isKeyFrame) {
                keyFrameReceived = true;
                keyFrameBuffers.push(buffer);
            }
            else if(!isStartFrame && !isKeyFrame && keyFrameReceived)
                    keyFrameBuffers.push(buffer);
            else if (!isKeyFrame && isStartFrame && keyFrameReceived) {
                if (keyFrameBuffers.length > 0) {
                    let totalLength = 0;
                    keyFrameBuffers.forEach((element: Uint8Array) => {
                        totalLength += element.length;
                    });
                    let offset = 0;
                    const mergedArray = new Uint8Array(totalLength);
                    keyFrameBuffers.forEach((element: Uint8Array) => {
                        mergedArray.set(element, offset);
                        offset += element.length;
                    });
                    keyFrameBuffers = [];
                    await process(mergedArray);
                }
                await process(buffer);
                }

            // buffer = buffer.slice(start);
            //return reader.read().then(processChunk);
        }
    }

  ngOnInit(): void {
 //    console.log("H264 component");
  }

  ngAfterViewInit(): void {
    this.file = this.fileEL.nativeElement;
    this.video = this.videoEL.nativeElement;
  }
}
