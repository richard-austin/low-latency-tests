import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';

declare function initMSTG(): void;
// MediaStreamTrackGenerator not in lib.dom.d.ts
declare let MediaStreamTrackGenerator: any

initMSTG();  // Set up MediaStreamTrackGenerator for platforms which don't support it
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
export class H264Component implements OnInit, AfterViewInit {
    @ViewChild("video") videoEL!: ElementRef<HTMLVideoElement>;

    file!: HTMLInputElement;
    video!: HTMLVideoElement;

    async start(): Promise<void> {

        const videoTrack = new MediaStreamTrackGenerator({kind: 'video'});

        // @ts-ignore
        const audioTrack = new window.MediaStreamTrackGenerator({kind: 'audio'});

        const videoWriter = videoTrack.writable.getWriter();
        const audioWriter = audioTrack.writable.getWriter();

        this.video.srcObject = new MediaStream([videoTrack, audioTrack])
        this.video.onloadedmetadata = () => {
            this.video.play().then();
        }
        this.video.preload = "none";

        if (typeof Worker !== 'undefined') {
            // Create a new media feeder web worker
            const videoWorker = new Worker(new URL('./video-feeder.worker', import.meta.url));
            videoWorker.onmessage = async ({data, type}) => {
                await videoWriter.write(data);
                await videoWriter.ready;
            };
            videoWorker.postMessage({url: "/ws/stream?suuid=cam1-stream1"})
            const audioWorker = new Worker(new URL('audio-feeder.worker', import.meta.url));
            this.video.onplaying = () => {
                audioWorker.onmessage = async ({data, type}) => {
                    if (!this.video.paused)
                        audioWriter.write(data);
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
        // const s = this.renderer.createElement("script");
        // s.type = "text/text";
        // s.src = "http://localhost:4200/mediastreamtrackgenerator.js";
        // this.renderer.appendChild(this._document.body, s);
        //


        //    console.log("H264 component");
    }

    ngAfterViewInit(): void {
        this.video = this.videoEL.nativeElement;
    }
}
