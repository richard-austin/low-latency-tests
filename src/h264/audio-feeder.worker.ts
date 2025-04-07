/// <reference lib="webworker" />

let audioFeeder: AudioFeeder;
addEventListener('message', ({ data }) => {
  if(data.url) {
    audioFeeder = new AudioFeeder();
    audioFeeder.setUpWSConnection(data.url);
  }
  else if(data.close && audioFeeder)
    audioFeeder.close();
});

class AudioFeeder {
// @ts-ignore
  audioDecoder = new AudioDecoder({
    // @ts-ignore
    output: async (frame: AudioData) => {
      postMessage(frame);
      frame.close();
    },
    error: (e: DOMException) => {
      console.warn("Audio decoder: " + e.message);
    },
  });

  readonly config = {
    numberOfChannels: 1,
    sampleRate: 8000, // Chrome hardcodes to 48000
    codec: 'alaw',
    bitrate: "32K",
  };

  url!:string;
  timeout!:NodeJS.Timeout;
  ws!: WebSocket;

  setUpWSConnection(url: string) {
    this.url = url;
    this.audioDecoder.configure(this.config);
    let framesToMiss = 12;

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onerror = (ev) => {
      console.error("An error occurred with the audio feeder websocket connection")
    }

    this.ws.onclose = (ev) => {
      postMessage({closed: true})
      console.info("The audio feed websocket was closed: " + ev.reason);
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.timeoutRestart();
    }, 6000)

    this.ws.onmessage = async (event: MessageEvent) => {
      // @ts-ignore
      const eac = new EncodedAudioChunk({
        type: 'key',
        timestamp: 100,
        duration: 10000,
        data: event.data,
      });
      if (framesToMiss > 0)
        --framesToMiss;
      else
        await this.audioDecoder.decode(eac)
      this.resetTimeout();
    };
  }

  resetTimeout = () => {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.timeoutRestart();
    }, 6000)
  }

  timeoutRestart = () => {
    console.error("Audio feed from websocket has stopped, restarting ...");
    this.setUpWSConnection(this.url);
  }

  close() {
    this.ws.close()
  }
}
