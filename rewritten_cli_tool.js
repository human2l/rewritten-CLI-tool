const messageContent = document.getElementById("messageContent");
const testContent = document.getElementsByClassName("test")[0];
const controlPanel = document.getElementsByClassName("control-panel")[0];
const controlPanelPlaceholder = document.getElementsByClassName(
  "control-panel-placeholder"
)[0];
const contentPlaceholder = document.getElementsByClassName(
  "content-placeholder"
)[0];
const parameterArea = document.getElementById("parameter-area");
const parameterAreaPlaceholder = document.getElementById(
  "parameter-area-placeholder"
);
const content = document.getElementsByClassName("content")[0];
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const inputFileElement = document.getElementById("fileInput");
const video = document.getElementById("inputVideoSrc");
const uploadCanvas = document.getElementById("uploadCanvas");
const uploadCtx = uploadCanvas.getContext("2d");
const endpointInput = document.getElementById("endpoint");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const typeInput = document.getElementById("type");
const borderCanvasArea = document.getElementById("border-canvas-area");
const showcaseCanvas = document.getElementById("showcaseCanvas");
const showcaseCtx = showcaseCanvas.getContext("2d");

let ws = undefined;
let cap = undefined;
let frame = undefined;
let imageScaleRatio = 1;
let videoIsProcessing = false;
let processingInterval = undefined;
let ignoreMessageReceived = false;
let mode = "realtimeMode";

init();

function init() {
  initDefaultConfiguration();
  initControlDisplayState();
  initConnectionSettings();
  initInputCanvas();
}

function initControlDisplayState() {
  controlPanel.hidden = true;
  content.hidden = true;
  contentPlaceholder.hidden = true;
  pauseBtn.hidden = true;
  parameterArea.hidden = true;
  parameterAreaPlaceholder.hidden = false;
}

function initDefaultConfiguration() {
  imageScaleRatio = 1 / 4;
  mode = "realtimeMode";
}

function initConnectionSettings() {
  endpointInput.value = "ws://192.168.1.209:8080";
  usernameInput.value = "kai";
  passwordInput.value = "anything";
  typeInput.value = "whiteboard";
}

//1920 2080    required:1920 1080
function initInputCanvas() {
  inputFileElement.addEventListener(
    "change",
    e => {
      content.hidden = true;
      contentPlaceholder.hidden = false;
      video.src = URL.createObjectURL(e.target.files[0]);
      video.oncanplay = function() {
        video.muted = true;
        video.height = video.videoHeight * imageScaleRatio;
        video.width = video.videoWidth * imageScaleRatio;
        startBtn.disabled = false;
        pauseBtn.disabled = false;
        resetBtn.disabled = false;
        content.hidden = false;
        contentPlaceholder.hidden = true;
        initVideoCapture();
      };
    },
    false
  );
}

function initVideoCapture() {
  cap = new cv.VideoCapture(video);
  frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
}

//This function is used when the svg content is shifted.
//It will send the first several frames slowly to give the server sometime to handle the input
var preparationInterval = undefined;
function preparation() {
  preparationInterval = setInterval(() => {
    processVideo();
  }, 2000);
}
//End the preparation Interval
function endPreparation() {
  clearInterval(preparationInterval);
}

//startBtn click event
function startAndSend() {
    //for realtime mode
  if (mode == "realtimeMode") {
    startBtn.hidden = true;
    pauseBtn.hidden = false;
    video.play();
    startProcessingInterval();
    //for stepping mode
  } else if (mode == "steppingMode") {

  }
}

//pauseBtn click event
function pause() {
    //for realtime mode
  if (mode == "realtimeMode") {
    if (!video.paused) {
      video.pause();
      pauseBtn.innerHTML = "Resume";
    } else {
      video.play();
      startProcessingInterval();
      pauseBtn.innerHTML = "Pause";
    }
    //for stepping mode
  } else if (mode == "steppingMode") {
  }
}

//resetBtn click event
function reset() {
    //for realtime mode 
  if (mode == "realtimeMode") {
    ignoreMessageReceived = true;
    pauseBtn.hidden = true;
    startBtn.hidden = false;
    video.pause();
    video.currentTime = 0;
    if (processingInterval != undefined) clearInterval(processingInterval);
    uploadCtx.clearRect(0, 0, uploadCanvas.width, uploadCanvas.height);
    showcaseCtx.clearRect(0, 0, showcaseCanvas.width, showcaseCanvas.height);
    if (borderCanvasArea.hasChildNodes()) {
      borderCanvasArea.removeChild(borderCanvasArea.childNodes[0]);
    }
    ignoreMessageReceived = false;
    //for stepping mode 
  } else if (mode == "steppingMode") {

  }
}

function buildConnection() {
  if (ws != undefined) {
    ws.close();
  }
  ws = new WebSocket(
    endpointInput.value +
      "?username=" +
      usernameInput.value +
      "&password=" +
      passwordInput.value
  );

  ws.onopen = function(evt) {
    console.log("Connection open ...");
  };

  ws.onmessage = function(evt) {
    console.log(evt.data);
    if (ignoreMessageReceived) return;
    messageContent.innerHTML = "";
    var evtObject = JSON.parse(evt.data);
    var messageArray = [];
    for (var index in evtObject) {
      var currentObject = evtObject[index];
      var firstKey = Object.keys(currentObject)[0];
      switch (firstKey) {
        case "version":
          messageContent.innerHTML = "Connected to IPSA!";
          //   console.log(currentObject);
          break;
        case "error":
          var errorMessage = currentObject[firstKey];
          messageArray.push("Error: " + errorMessage);
          break;
        case "warning":
          var warningMessage = currentObject[firstKey];
          messageArray.push("Warning: " + warningMessage);
          break;
        case "processing_time":
          videoIsProcessing = false;
          // console.log(currentObject);
          break;
        case "svg":
          handleSVG(currentObject);
          break;
        case "corners":
          handleCorners(currentObject);
          break;
        default:
          break;
      }
    }
    var message = "";
    for (var index in messageArray) {
      message += messageArray[index] + ". ";
      message += "<br />";
    }
    messageContent.innerHTML += message;
  };

  ws.onclose = function(evt) {
    console.log("Connection closed.");
    messageContent.innerHTML = "Connection closed!";
  };
  ws.onerror = function(evt) {
    console.log(evt);
  };
}

//When opencv.js loaded successfully
function onOpenCvReady() {
  messageContent.innerHTML = "opencv.js is ready!";
  cv["onRuntimeInitialized"] = () => {
    controlPanelPlaceholder.hidden = true;
    controlPanel.hidden = false;
  };
}

//Note: the limit of server to handle the jpg is around 1.5 second.
//When keep sending the jpg file too frequently, the svg content will shift (Same as the bug testing team found)
function startProcessingInterval() {
  processingInterval = setInterval(() => {
    processVideo();
    if (video.paused) clearInterval(processingInterval);
  }, 1500);
}

function processVideo() {
  if (inputFileElement.files.item(0) == null) return;
  if (videoIsProcessing) return;
  videoIsProcessing = true;
  cap.read(frame);
  cv.imshow("uploadCanvas", frame);
  var imgURI = uploadCanvas.toDataURL("image/jpeg");
  var bytesarray = Utils.convertBase64ToBytearray(imgURI);
  ws.send(bytesarray);
}

//show svg image through showcaseCanvas
function handleSVG(svgObject) {
  var svgString = svgObject.svg;
  var svgNode = Utils.createElementFromHTML(svgString);
  showcaseCanvas.width = video.width;
  showcaseCanvas.height = video.height;
  var context = showcaseCanvas.getContext("2d");
  context.clearRect(0, 0, showcaseCanvas.width, showcaseCanvas.height);
  Utils.importSVG(svgNode, showcaseCanvas);
}

//show corners through cornerCanvas
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
  if (borderCanvasArea.hasChildNodes())
    borderCanvasArea.replaceChild(borderCanvas, borderCanvasArea.childNodes[0]);
  else borderCanvasArea.appendChild(borderCanvas);
}

function toggleMode(e) {
  mode = e.id;
  if (mode == "realtimeMode") {
    parameterArea.hidden = true;
    parameterAreaPlaceholder.hidden = false;
  } else if (mode == "steppingMode") {
    parameterArea.hidden = false;
    parameterAreaPlaceholder.hidden = true;
  }
}
