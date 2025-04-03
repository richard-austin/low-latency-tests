/// <reference lib="webworker" />

addEventListener('message', ({data}) => {
  setUpWebsocketConnection(data.url);
});


let decoder: VideoDecoder;
let firstKeyFrameReceived: boolean = false;

function setupDecoder(): void {
  firstKeyFrameReceived = false;
  decoder = new VideoDecoder({
    output: async (frame) => {
      postMessage(frame);
      frame.close();
    },
    error: (e) => {
      console.warn("Video decoder:" + e.message);
      setupDecoder();
    },
  });
}

setupDecoder();

let isHEVC: boolean = false;

let processMessage = async (data: Uint8Array): Promise<void> => {
  // let processStart = performance.now();
  if (decoder.state !== "configured") {
    const config = {codec: (isHEVC ? "hvc1.1.4.L16.B0" : "avc1.640028"), optimizeForLatency: true};
    decoder.configure(config);
  }
  const chunk = new EncodedVideoChunk({
    timestamp: (performance.now()) * 1000,
    type: (data[4] & 0x0f) === 7 ? "key" : "delta",
    data: data,
  });
  decoder.decode(chunk);
  // console.log("process time: "+(performance.now()-processStart))
}

function setUpWebsocketConnection(url: string) {
  let ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = (event: MessageEvent) => {
    processChunk(event.data).then();
  };

  ws.onerror = (ev) => {
    console.error("An error occurred with the video feeder websocket connection")
  }

  ws.onclose = (ev) => {
    console.error("The video feed websocket was closed: " + ev.reason)
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
    console.error("Video feed from websocket has stopped, restarting ...");
    setUpWebsocketConnection(url);
  }

  let buffer = new Uint8Array();

  let largeBuffers: Uint8Array[] = [];
  let bufferInUse = false;

  async function processChunk(value: ArrayBuffer): Promise<void> {
    //  let processChunkStart = performance.now();
    resetTimeout();
    buffer = new Uint8Array(value);
    const i = 0
    const isStartFrame = (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) ||
        (buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1);
    isHEVC = buffer[2] === 1;

    const isKeyFrame = !isHEVC ? isStartFrame && (((buffer[i + 4] & 0x07) === 7)) : buffer[3] === 0x40;

    if (isKeyFrame)
      firstKeyFrameReceived = true;
    if (firstKeyFrameReceived) {
      if (isStartFrame && bufferInUse) {
        await putLargeFrames();
        bufferInUse = false;
      }
      // If the length is the maximum packet size, put into the large buffers array to append
      //  together for processing by the decoder
      if (value.byteLength >= 32767)
        bufferInUse = true;
      if (bufferInUse) {
        largeBuffers.push(buffer);
      } else if (isStartFrame)
        await processMessage(buffer);
      else
        console.error("Video processing: malformed message received")
    }
  }

  const putLargeFrames = async (): Promise<void> => {
    if (largeBuffers.length > 0) {
      let totalLength = 0;
      largeBuffers.forEach((element: Uint8Array) => {
        totalLength += element.length;
      });
      let offset = 0;
      const mergedArray = new Uint8Array(totalLength);
      largeBuffers.forEach((element: Uint8Array) => {
        mergedArray.set(element, offset);
        offset += element.length;
      });
      largeBuffers = [];
      await processMessage(mergedArray);
    }
  }
}
