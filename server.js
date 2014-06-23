#!/usr/bin/env node

var HTTP_PORT = 50000;
var PEER_PORT = 16472;

// signaling server
var fs = require('fs');
var ps = require('peer').PeerServer;

var peerServer = new ps({
	port: PEER_PORT,
	path: '/peer',
	allow_discovery: true,
});

// static HTTP server
var static = require('node-static');
var file = new static.Server('./static');

require('http').createServer(function(req, res) {
	req.addListener('end', function () {
		// enable CORS
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, *');
		file.serve(req, res);
	}).resume();
}).listen(HTTP_PORT);
