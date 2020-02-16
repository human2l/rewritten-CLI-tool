'use strict';

const fs = require('fs');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
var app = express();
const PORT = 9009;
const server = http.createServer(app);
const wss = new WebSocket.Server({
    clientTracking: false,
    noServer: true
});

server.on('upgrade', function(request, socket, head) {
    wss.handleUpgrade(request, socket, head, function(ws) {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', function(ws, request) {
    console.log('AAA');
    ws.on('message', data => {
	console.log("DDDD")
        fs.writeFile('./tmp/test.jpg', data, (err) => {
            if (err) throw err;
        ws.send("got that jpg!");
	    console.log('File saved');
        });
    });
});

app.get('/', function(req, res) {
    res.sendStatus(200);
});

server.listen(PORT, function() {
    console.log(`Listening on port ${PORT}`);
});
