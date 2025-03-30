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
    @ViewChild("file") fileEL!: ElementRef<HTMLInputElement>;
    @ViewChild("video") videoEL!: ElementRef<HTMLVideoElement>;

    file!: HTMLInputElement;
    video!: HTMLVideoElement;

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

    async loadFile(): Promise<void> {
        // @ts-ignore
        const file = this.file.files[0];
        const stream = file.stream();
        const reader = stream.getReader();
        const process = this.process;
        this.video.srcObject = new MediaStream([this.trackGenerator])
        this.video.onloadedmetadata = () => {
            this.video.play().then();
        }

        let buffer = new Uint8Array();

        let doneFirstPass = false;
        return reader.read().then(async function processChunk({done, value}): Promise<void> {
            if (done) {
               // writer.releaseLock();
                return; // process(buffer);
            } else {
                buffer = new Uint8Array([...buffer, ...value]);
                let start = 0
                for (let i = 0; i < buffer.length; i++) {
                    if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1 && (((buffer[i + 4] & 0x07) === 7) || doneFirstPass)) {
                        if (i !== start) {
                            const frame = buffer.slice(start, i);
                            await process(frame);
                            //doneFirstPass = true;
                        }
                        start = i;
                    }
                }
                buffer = buffer.slice(start);
                return reader.read().then(processChunk);
            }
        });
    }

  ngOnInit(): void {
 //    console.log("H264 component");
  }

  ngAfterViewInit(): void {
    this.file = this.fileEL.nativeElement;
    this.video = this.videoEL.nativeElement;
  }
}
