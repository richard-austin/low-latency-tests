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
    readonly videoTrack = new MediaStreamTrackGenerator({ kind: 'video' });

    // @ts-ignore
    readonly audioTrack = new MediaStreamTrackGenerator({kind: 'audio'});

    readonly videoWriter = this.videoTrack.writable.getWriter();
    readonly audioWriter = this.audioTrack.writable.getWriter();

    async start(): Promise<void> {
        this.video.srcObject = new MediaStream([this.videoTrack, this.audioTrack])
        this.video.onloadedmetadata = () => {
            this.video.play().then();
        }
        this.video.preload = "none";

        if (typeof Worker !== 'undefined') {
            // Create a new media feeder web worker
            const videoWorker = new Worker(new URL('./video-feeder.worker', import.meta.url));
            videoWorker.onmessage = async ({data, type}) => {
                await this.videoWriter.write(data);
                await this.videoWriter.ready;
            };
            videoWorker.postMessage({url: "/ws/stream?suuid=cam1-stream1"})
            const audioWorker = new Worker(new URL('audio-feeder.worker', import.meta.url));
            this.video.onplaying = () => {
                audioWorker.onmessage = async ({data, type}) => {
                    if (!this.video.paused)
                        this.audioWriter.write(data);
                   // await this.audioWriter.ready;
                }
            }
            audioWorker.postMessage({url: "/ws/stream?suuid=cam1-stream1a"})
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
