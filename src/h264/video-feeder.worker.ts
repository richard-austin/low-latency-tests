/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  setUpWebsocketConnection(data.url);
 });


let decoder: VideoDecoder;
let keyFrameReceived: boolean = false;

function setupDecoder() : void {
  keyFrameReceived = false;
  decoder = new VideoDecoder({
    output: async (frame) => {
      postMessage(frame);
      frame.close();
    },
    error: (e) => {
      console.warn(e.message);
      setupDecoder();
    },
  });
}

setupDecoder();

let processMessage = async (data: Uint8Array): Promise<void> => {
 // let processStart = performance.now();
  if (decoder.state !== "configured") {
    const config = {codec: "avc1.640028", optimizeForLatency: true};
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

  let buffer = new Uint8Array();

  let keyFrameBuffers: Uint8Array[] = [];

  async function processChunk(value: ArrayBuffer): Promise<void> {
  //  let processChunkStart = performance.now();
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
        await processMessage(mergedArray);
      }
      await processMessage(buffer);
    }
    // console.log("processChunk time: "+(performance.now()-processChunkStart))
    // buffer = buffer.slice(start);
    //return reader.read().then(processChunk);
  }
}
