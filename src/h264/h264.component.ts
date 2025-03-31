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
    @ViewChild("video") videoEL!: ElementRef<HTMLVideoElement>;

    file!: HTMLInputElement;
    video!: HTMLVideoElement;
    // @ts-ignore (MediaStreamTrackGenerator not in lib.dom.d.ts for some reason)
    readonly trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    readonly defaultWriter = this.trackGenerator.writable.getWriter();

    async start(): Promise<void> {
    //    const process = this.process;
        this.video.srcObject = new MediaStream([this.trackGenerator])
        this.video.onloadedmetadata = () => {
            this.video.play().then();
        }

        if (typeof Worker !== 'undefined') {
            // Create a new media feeder web worker
            const worker = new Worker(new URL('./media-feeder.worker', import.meta.url));
            worker.onmessage = async ({data, type}) => {
                await this.defaultWriter.write(data);
                await this.defaultWriter.ready;
            };
            worker.postMessage({url: "/ws/stream?suuid=stream1"})
        } else {
            // Web workers are not supported in this environment.
            // You should add a fallback so that your program still executes correctly.
        }
    }

  ngOnInit(): void {
 //    console.log("H264 component");
  }

  ngAfterViewInit(): void {
    this.video = this.videoEL.nativeElement;
  }
}
