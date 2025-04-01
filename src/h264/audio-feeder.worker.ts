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
  error: console.warn,
});

const config = {
  numberOfChannels: 1,
  sampleRate: 8000, // Chrome hardcodes to 48000
  codec: 'pcm-s16',
  bitrate: 64000,
};

function setUpWSConnection(url: string) {
  audioDecoder.configure(config);

  let ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = async (event: MessageEvent) => {
    // @ts-ignore
    const eac = new EncodedAudioChunk({
      type: 'key',
      timestamp: 0,
      duration: 1000,
      data: event.data,
    });
    await audioDecoder.decode(eac)
  //  processChunk(event.data).then();
  };
}

  // @ts-ignore
async function processChunk(value: AudioData): Promise<void> {
    //  let processChunkStart = performance.now();
    postMessage(value)
    // console.log("processChunk time: "+(performance.now()-processChunkStart))
    // buffer = buffer.slice(start);
    //return reader.read().then(processChunk);
}
