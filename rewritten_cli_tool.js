const testContent = document.getElementsByClassName("test")[0];
const controlPanel = document.getElementsByClassName("control-panel")[0];
const controlPanelPlaceholder = document.getElementsByClassName(
  "control-panel-placeholder"
)[0];
const contentPlaceholder = document.getElementsByClassName(
  "content-placeholder"
)[0];
const content = document.getElementsByClassName("content")[0];
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const inputFileElement = document.getElementById("fileInput");
const video = document.getElementById("inputVideoSrc");
const uploadCanvas = document.getElementById("uploadCanvas");
const uploadCtx = uploadCanvas.getContext("2d");
// const svgShowCase = document.getElementsByClassName("svg-showcase")[0];
const borderCanvasArea = document.getElementById("border-canvas-area");
let ws = undefined;
let cap = undefined;
let frame = undefined;
let imageScaleRatio = 1 / 4;
const showcaseCanvas = document.getElementById("showcaseCanvas");
const showcaseCtx = showcaseCanvas.getContext("2d");

init();
initConnection();
initInputCanvas();

function init() {
  controlPanel.hidden = true;
  content.hidden = true;
  contentPlaceholder.hidden = true;
}

function startAndSend() {
  startBtn.disabled = true;
  processVideo();
}

function pause() {
  if (!video.paused) {
    video.pause();
    pauseBtn.innerHTML = "Resume";
  } else {
    processVideo();
    pauseBtn.innerHTML = "Pause";
  }
}

function reset() {
  video.pause();
  video.currentTime = 0;
  uploadCtx.clearRect(0, 0, uploadCanvas.width, uploadCanvas.height);
  showcaseCtx.clearRect(0, 0, showcaseCanvas.width, showcaseCanvas.height);
}

function initConnection() {
  ws = new WebSocket(
    // "wss://aminaiee@gmail.com:JIBB1234!@ipsa.testing.jibb.cloud/"
    // "ws://localhost:9009/"
    // "ws://kai:JIBB1234!@192.168.1.209:8080"
    "ws://192.168.1.209:8080?username=kai&password=anything"
    // "ws://ipsa.testing.jibb.cloud?username=kai&password=anything"
  );

  ws.onopen = function(evt) {
    console.log("Connection open ...");
  };

  ws.onmessage = function(evt) {
    console.log("Received Message: " + evt.data);
    startBtn.disabled = false;
    var evtObject = JSON.parse(evt.data);
    // console.log(evtObject);

    //TODO: add handle warning & error message

    //need to modify to a more logical one
    if (evtObject[2] != undefined) {
      var svgObject = evtObject[2];
      handleSVG(svgObject);
      var cornerObject = evtObject[3];
      handleCorners(cornerObject);
    }
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
    controlPanelPlaceholder.hidden = true;
    controlPanel.hidden = false;
  };
}

//1920 2080
function initInputCanvas() {
  inputFileElement.addEventListener(
    "change",
    e => {
      content.hidden = true;
      contentPlaceholder.hidden = false;
      video.src = URL.createObjectURL(e.target.files[0]);
      setTimeout(() => {
        video.height = video.videoHeight * imageScaleRatio;
        video.width = video.videoWidth * imageScaleRatio;
        startBtn.disabled = false;
        pauseBtn.disabled = false;
        resetBtn.disabled = false;
        content.hidden = false;
        contentPlaceholder.hidden = true;
        initVideoCapture();
      }, 3000);
    },
    false
  );
}

function initVideoCapture() {
  cap = new cv.VideoCapture(video);
  frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
}

function processVideo() {
  if (video.paused) video.play();
  cap.read(frame);
  cv.imshow("uploadCanvas", frame);
  var imgURI = uploadCanvas.toDataURL("image/jpeg");
  var bytesarray = convertBase64ToBytearray(imgURI);
  ws.send(bytesarray);
}

const convertBase64ToBytearray = function(image) {
  const byteString = atob(image.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return ia;
};

function handleSVG(svgObject) {
  var svgString = svgObject.svg;
  var svgNode = Utils.createElementFromHTML(svgString);
  //for testing:
  //   svgShowCase.replaceChild(svgNode, svgShowCase.childNodes[0]);
  //   showcaseCanvas.width = svgNode.getAttribute("width") * imageScaleRatio;
  //   showcaseCanvas.height = svgNode.getAttribute("height") * imageScaleRatio;
  showcaseCanvas.width = video.width;
  showcaseCanvas.height = video.height;
  var context = showcaseCanvas.getContext("2d");
  context.clearRect(0, 0, showcaseCanvas.width, showcaseCanvas.height);
  Utils.importSVG(svgNode, showcaseCanvas);
}

function handleCorners(cornerObject) {
  var borderCanvas = Utils.cloneCanvas(uploadCanvas);
  var borderCtx = borderCanvas.getContext("2d");
  borderCtx.moveTo(
    (cornerObject.corners[3].x * borderCanvas.width) / 100,
    (cornerObject.corners[3].y * borderCanvas.height) / 100
  );
  for (var key in cornerObject.corners) {
    borderCtx.lineTo(
      (cornerObject.corners[key].x * borderCanvas.width) / 100,
      (cornerObject.corners[key].y * borderCanvas.height) / 100
    );
  }
  borderCtx.strokeStyle = "red";
  borderCtx.stroke();
  borderCanvasArea.replaceChild(borderCanvas, borderCanvasArea.childNodes[0]);
}

Utils = {
  createElementFromHTML: function(htmlString) {
    var div = document.createElement("div");
    div.innerHTML = htmlString.trim();

    // Change this to div.childNodes to support multiple top-level nodes
    return div.firstChild;
  },

  importSVG: function(sourceSVG, targetCanvas) {
    svg_xml = new XMLSerializer().serializeToString(sourceSVG);
    var ctx = targetCanvas.getContext("2d");
    var img = new Image();
    img.src = "data:image/svg+xml;base64," + btoa(svg_xml);

    img.onload = function() {
      ctx.drawImage(img, 0, 0, targetCanvas.width, targetCanvas.height);
    };
  },

  cloneCanvas: function(oldCanvas) {
    var newCanvas = document.createElement("canvas");
    var context = newCanvas.getContext("2d");
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;
    context.drawImage(oldCanvas, 0, 0);
    return newCanvas;
  }
};

function showSize() {
  console.log(video.height + "video w: " + video.width);
  console.log(uploadCanvas.height + "uploadCanvas w:" + uploadCanvas.width);
  console.log(
    showcaseCanvas.height + "showcaseCanvas w:" + showcaseCanvas.width
  );
}
