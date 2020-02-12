const inputFileElement = document.getElementById("fileInput");
const video = document.getElementById("inputVideoSrc");
const canvas = document.getElementById("canvasImage");
const ctx = canvas.getContext("2d");
let ws = undefined;
initConnection();
initInputCanvas();

function initConnection() {
  ws = new WebSocket(
    "wss://aminaiee@gmail.com:JIBB1234!@ipsa.testing.jibb.cloud/"
  );

  ws.onopen = function(evt) {
    console.log("Connection open ...");
  };

  ws.onmessage = function(evt) {
      console.log(evt)
    console.log("Received Message: " + evt.data);
  };

  ws.onclose = function(evt) {
    console.log(evt);
    console.log("Connection closed.");
  };
  ws.onerror = function(evt) {
    console.log(evt);
  };
}

function onOpenCvReady() {
  console.log("opencv.js is ready");
  cv["onRuntimeInitialized"] = () => {
    //do something only after ready
    // run();
  };
}

//1920 2080
function initInputCanvas() {
  inputFileElement.addEventListener(
    "change",
    e => {
        // video.hidden = true;
      video.src = URL.createObjectURL(e.target.files[0]);
      setTimeout(() => {
          video.height = video.videoHeight/4;
          video.width = video.videoWidth/4;
        //   video.hidden = false;
        run();
      }, 3000);
    //   run();
    },
    false
  );
}

function run() {
  const FPS = 30;
  let cap = new cv.VideoCapture(video);
  // take first frame of the video
  // video.height, video.width, cv.CV_8UC4
  let frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);

  function processVideo() {
    let begin = Date.now();
    cap.read(frame);
    cv.imshow("canvasImage", frame);
    var imgURI = canvas.toDataURL("image/jpeg");
    console.log(imgURI);
    //byteString: decoded from base64
    byteStringTest = atob(imgURI.split(",")[1]);
    console.log(byteStringTest)
    // ws.send(byteStringTest);
    //1
    var buffer1 = convertBase64ToFile(imgURI);
    console.log(1)
    console.log(buffer1);
    //2
    const byteString = imgURI.split(",")[1];
    var buffer2 = _base64ToArrayBuffer(byteString);
    console.log(2)
    console.log(buffer2)
    //3
    var buffer3 = decodeBase64(imgURI);
    console.log(3)
    console.log(buffer3);
    console.log(new Uint8Array(buffer3))
    // ws.send(new Uint8Array(buffer3));
    // ws.send(buffer3);
    //4
    // const byteString = imgURI.split(",")[1];
    // var bytesArray = Uint8Array.from(atob(byteString), c => c.charCodeAt(0));
    // console.log(bytesArray);
    // ws.send(bytesArray);
    return;
    

    // onInputImage()


    // download("image_data", result);

    //--testing---
    // setTimeout(() => {
    //     var img = ctx.getImageData(0, 0, 400, 320);
    //     var binary = new Uint8Array(img.data.length);
    //     for (var i = 0; i < img.data.length; i++) {
    //       binary[i] = img.data[i];
    //     }
    //     console.log(binary.buffer);
    //     ws.send(binary.buffer);
    // }, 3000);

    // onInputImage(result);
    return;

    let delay = 1000 / FPS - (Date.now() - begin);
    // console.log(Date.now() - begin);
    setTimeout(processVideo, delay);
  }
  video.play();
  // schedule the first one.
  setTimeout(processVideo, 0);
}

function onInputImage() {
  imagedata = ctx.getImageData(0, 0, video.height, video.width);
  var canvaspixelarray = imagedata.data;
  var canvaspixellen = canvaspixelarray.length;
  var bytearray = new Uint8Array(canvaspixellen);
  for (var i = 0; i < canvaspixellen; ++i) {
    bytearray[i] = canvaspixelarray[i];
  }
  console.log(bytearray.buffer);
//   ws.send(bytearray.buffer);
}

//for testing---------------
const inputImage = document.getElementById("inputImage");
const image = document.getElementById("image");
inputImage.addEventListener(
  "change",
  e => {
    image.src = URL.createObjectURL(e.target.files[0]);

    //   ws.send(image)
  },
  false
);

image.onload = function() {
  image.height = "480";
  image.width = "520";
  let mat = cv.imread(image);
  cv.imshow("inputImageCanvas", mat);
  mat.delete();
};


function _base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;

}

//original
const convertBase64ToFile = function(image) {
  const byteString = atob(image.split(",")[1]);
    // console.log(typeof(byteString))
    // new bytearray()
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return ia.buffer;
  const newBlob = new Blob([ab], {
    type: "image/jpeg"
  });
  console.log(newBlob)
  ws.send(newBlob)



  //Download the newBlob as jpg
  var link = document.createElement('a');
    link.href = window.URL.createObjectURL(newBlob);
    var fileName = "blah.jpg";
    link.download = fileName;
    link.click();
};

function decodeBase64(inputString){
    return decode(inputString)
}


//Copied from online! Delete after research!
var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Use a lookup table to find the index.
  var lookup = new Uint8Array(256);
  for (var i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
function decode(base64) {
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = lookup[base64.charCodeAt(i)];
      encoded2 = lookup[base64.charCodeAt(i+1)];
      encoded3 = lookup[base64.charCodeAt(i+2)];
      encoded4 = lookup[base64.charCodeAt(i+3)];

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
  };