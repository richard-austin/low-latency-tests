/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  setUpWSConnection(data.url);
});

// @ts-ignore
let audioDecoder = new AudioDecoder({
  // @ts-ignore
   output: async (frame: AudioData) => {
    postMessage(frame);
    frame.close();
  },
  error: (e: DOMException) => {
     console.warn("Audio decoder: "+e.message);
  },
});

const config = {
  numberOfChannels: 1,
  sampleRate: 8000, // Chrome hardcodes to 48000
  codec: 'pcm-s16',
  bitrate: 64000,
};

function setUpWSConnection(url: string) {
  audioDecoder.configure(config);
  let framesToMiss = 12;

  let ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onerror = (ev) => {
    console.error("An error occurred with the audio feeder websocket connection")
  }

  ws.onclose = (ev) => {
    console.error("The audio feed websocket was closed: " + ev.reason)
  }

  let timeout = setTimeout(() => {
    timeoutRestart();
  }, 6000)

  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeoutRestart();
    }, 6000)
  }
  const timeoutRestart = () => {
    console.error("Audio feed from websocket has stopped, restarting ...");
    setUpWSConnection(url);
  }

  ws.onmessage = async (event: MessageEvent) => {
    // @ts-ignore
    const eac = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      duration: 0,
      data: event.data,
    });
    if(framesToMiss > 0)
      --framesToMiss;
    else
      await audioDecoder.decode(eac)
    resetTimeout();
  //  processChunk(event.data).then();
  };
}
