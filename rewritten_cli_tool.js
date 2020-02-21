const messageContent = document.getElementById("messageContent");
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
const uploadShowcaseCanvas = document.getElementById("uploadShowcaseCanvas");
const uploadShowcaseCtx = uploadShowcaseCanvas.getContext("2d");
const endpointInput = document.getElementById("endpoint");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const typeInput = document.getElementById("type");
const borderCanvasArea = document.getElementById("border-canvas-area");
const showcaseCanvas = document.getElementById("showcaseCanvas");
const showcaseCtx = showcaseCanvas.getContext("2d");
const minimumSendingDelayInput = document.getElementById("minimumSendingDelay");
let ws = undefined;
let cap = undefined;
let frame = undefined;
let videoHeight = undefined;
let videoWidth = undefined;
let videoIsProcessing = false;
let realtimeProcessingInterval = undefined;

init();

function init() {
  initDefaultConfiguration();
  initControlDisplayState();
  initConnectionSettings();
  initInputCanvas();
  bindKeyEvent();
}

function initControlDisplayState() {
  controlPanel.hidden = true;
  content.hidden = true;
  contentPlaceholder.hidden = true;
  pauseBtn.hidden = true;
}

function initDefaultConfiguration() {
  videoHeight = "1920";
  videoWidth = "1080";
  mode = "realtimeMode";
  minimumSendingDelayInput.value = "1.5";
}

function initConnectionSettings() {
  // Check browser support
  if (typeof Storage !== "undefined") {
    localStorage.getItem("endpoint") !== undefined
      ? (endpointInput.value = localStorage.getItem("endpoint"))
      : localStorage.setItem("endpoint", "");
    localStorage.getItem("username") !== undefined
      ? (usernameInput.value = localStorage.getItem("username"))
      : localStorage.setItem("username", "");
    localStorage.getItem("password") !== undefined
      ? (passwordInput.value = localStorage.getItem("password"))
      : localStorage.setItem("password", "");
    localStorage.getItem("type") !== undefined
      ? (typeInput.value = localStorage.getItem("type"))
      : localStorage.setItem("type", "");
  } else {
    console.log("Sorry, your browser does not support Web Storage...");
  }
}

function saveSettings() {
  localStorage.setItem("endpoint", endpointInput.value);
  localStorage.setItem("username", usernameInput.value);
  localStorage.setItem("password", passwordInput.value);
  localStorage.setItem("type", typeInput.value);
}

function cancelSettings() {
  endpointInput.value = localStorage.getItem("endpoint");
  usernameInput.value = localStorage.getItem("username");
  passwordInput.value = localStorage.getItem("password");
  typeInput.value = localStorage.getItem("type");
}

//required:1920 1080
function initInputCanvas() {
  inputFileElement.addEventListener(
    "change",
    e => {
      content.hidden = true;
      contentPlaceholder.hidden = false;
      video.src = URL.createObjectURL(e.target.files[0]);
      video.onloadeddata = function() {
        if (video.videoHeight > video.videoWidth) {
          videoHeight = "1920";
          videoWidth = "1080";
        } else {
          videoWidth = "1920";
          videoHeight = "1080";
        }
        video.height = videoHeight;
        video.width = videoWidth;
      };
      video.oncanplay = function() {
        video.muted = true;
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

//To keep connection alive
function initConnectionInterval() {
  setInterval(() => {
    ws.send(JSON.stringify({ cmd: "keep_alive" }));
  }, 2500);
}

function initVideoCapture() {
  cap = new cv.VideoCapture(video);
  frame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
}

//startBtn click event
function startAndSend() {
  startBtn.hidden = true;
  pauseBtn.hidden = false;
  minimumSendingDelayInput.disabled = true;
  video.play();
  startRealtimeProcessingInterval();
}

//pauseBtn click event
function pause() {
  if (!video.paused) {
    video.pause();
    clearInterval(realtimeProcessingInterval);
    videoIsProcessing = false;
    pauseBtn.innerHTML = "Resume";
  } else {
    video.play();
    startRealtimeProcessingInterval();
    pauseBtn.innerHTML = "Pause";
  }
}

//resetBtn click event
function reset() {
  pauseBtn.hidden = true;
  startBtn.hidden = false;
  minimumSendingDelayInput.disabled = false;
  video.pause();
  videoIsProcessing = false;
  video.currentTime = 0;
  if (realtimeProcessingInterval != undefined)
    clearInterval(realtimeProcessingInterval);
  uploadCtx.clearRect(0, 0, uploadCanvas.width, uploadCanvas.height);
  uploadShowcaseCtx.clearRect(
    0,
    0,
    uploadShowcaseCanvas.width,
    uploadShowcaseCanvas.height
  );
  showcaseCtx.clearRect(0, 0, showcaseCanvas.width, showcaseCanvas.height);
  if (borderCanvasArea.hasChildNodes()) {
    borderCanvasArea.removeChild(borderCanvasArea.childNodes[0]);
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
    inputFileElement.disabled = false;
    console.log("Connection open ...");
    initConnectionInterval();
  };

  ws.onmessage = function(evt) {
    // console.log(evt);
    messageContent.innerHTML = "";
    var evtObject = JSON.parse(evt.data);
    var messageArray = [];
    for (var index in evtObject) {
      var currentObject = evtObject[index];
      var firstKey = Object.keys(currentObject)[0];
      switch (firstKey) {
        case "version":
          messageContent.innerHTML = "Connected to IPSA!";
          console.log(currentObject);
          break;
        case "error":
          if (video.paused) return;
          var errorMessage = currentObject[firstKey];
          messageArray.push("Error: " + errorMessage);
          break;
        case "warning":
          if (video.paused) return;
          var warningMessage = currentObject[firstKey];
          messageArray.push("Warning: " + warningMessage);
          break;
        case "processing_time":
          if (video.paused) return;
          Utils.cloneCanvasContent(uploadCanvas, uploadShowcaseCanvas);
          videoIsProcessing = false;
          break;
        case "svg":
          if (video.paused) return;
          handleSVG(currentObject);
          break;
        case "corners":
          if (video.paused) return;
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
function startRealtimeProcessingInterval() {
  realtimeProcessingInterval = setInterval(() => {
    processRealtimeVideo();
  }, minimumSendingDelayInput.value * 1000);
}

function processRealtimeVideo() {
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
  showcaseCanvas.width = svgNode.width.baseVal.value;
  showcaseCanvas.height = svgNode.height.baseVal.value;
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


function bindKeyEvent() {
    $(document).keydown(function(e) {
      switch (e.which) {
        //Spacebar
        case 32:
          pause()
          break;
        default:
          // exit this handler for other keys
          return;
      }
      //prevent default key actions
      e.preventDefault();
    });
  }