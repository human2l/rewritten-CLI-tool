Utils = {
  createElementFromHTML: function(htmlString) {
    var div = document.createElement("div");
    div.innerHTML = htmlString.trim();

    // Change this to div.childNodes to support multiple top-level nodes
    return div.firstChild;
  },

  //param: image -- type:imageURI
  convertBase64ToBytearray: function(image) {
    const byteString = atob(image.split(",")[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return ia;
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
