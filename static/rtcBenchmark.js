/*
 * Copyright (c) 2014 Aalto University
 * Copyright (c) 2014 Rasmus Eskola
 * Licensed under the MIT License, see LICENSE for more information.
 */

// how many samples to gather from the various tests
var serverCnt = 25;
var peerListCnt = 100;
var peerConnectCnt = 50;
var rttCnt = 1000;
var throughputTime = 60 * 1000; // a minute

var serverConnect = function(id) {
	return new Peer(id, {
		host: 'fruitiex.org',
		port: '16472',
		path: '/peer',
		config: {
			'iceServers': [
				{ url: 'stun:stun.l.google.com:19302' },
				{ url: 'turn:fruitiex.org:3478', username: "rasse", credential: 'foobar' }
			]
		}
	});
};

function ping() {
	var avg = 0; var jitter = 0; var min = 999999999; var max = 0; var samples = 0;
	var times = []; var jitters = [];
	var pingTime;

	this.getStats = function() {
		return 'min: ' + min + ', max: ' + max + ', avg: ' + avg + ', jitter: ' + jitter;
	};

	this.getNumSamples = function() {
		return samples;
	};

	this.setPingTime = function() {
		pingTime = new Date().getTime();
	};

	this.update = function(updateCallback) {
		var time = new Date().getTime() - pingTime;
		if(times.length)
			jitters[jitters.length] = Math.abs(time - times[times.length - 1]);

		times[times.length] = time;
		for(var i = 0; i < times.length; i++) {
			avg += times[i];

			if(jitters[i])
				jitter += jitters[i];

			if(times[i] < min)
				min = times[i];
			if(times[i] > max)
				max = times[i];
		}
		avg /= times.length;
		avg = Math.round(avg * 100) / 100;

		if (jitters.length)
			jitter /= jitters.length;
		jitter = Math.round(jitter * 100) / 100;

		samples++;

		//pingTime = new Date().getTime();
		updateCallback();
	};
};

var serverConnectTime = new ping();
var peerListTime = new ping();
var peerConnectTime = new ping();
var peerRTT = new ping();
var peer;

$(document).ready(function() {
	// wait a little more
	setTimeout(function() {
		serverConnectTime.setPingTime();
		peer = serverConnect();
		peer.on('open', peeronopen);
	}, 1000);
});

var peeronopen = function() {
	if(serverConnectTime.getNumSamples() < serverCnt) {
		serverConnectTime.update(function() {
			$("#server").text('Connection to server took (ms): ' + serverConnectTime.getStats());
			$("#serversamples").text('sample ' + serverConnectTime.getNumSamples() + '/' + serverCnt);

			peer.destroy();
			setTimeout(function() {
				serverConnectTime.setPingTime();
				peer = serverConnect();
				peer.on('open', peeronopen);
			}, 750);
		});
	} else {
		$("#peerid").text("Peer ID: " + peer.id);

		peerList();
	}
};

var onlistpeers = function() {
	peerListTime.update(function() {
		$("#peerlist").text('Listing peers took (ms): ' + peerListTime.getStats());
		$("#peerlistsamples").text('sample ' + peerListTime.getNumSamples() + '/' + peerListCnt);

		if(peerListTime.getNumSamples() < peerListCnt) {
			setTimeout(function() {
				peerListTime.setPingTime();
				peer.listAllPeers(function(peers) {
					onlistpeers();
				});
			}, 100);
		} else {
			peerConnect('server');
		}
	});
};

var peerList = function() {
	peerListTime.setPingTime();
	peer.listAllPeers(function(peers) {
		onlistpeers();
	});
};

var peerConnect = function(id) {
	peerConnectTime.setPingTime();
	var dataConnection = peer.connect(id);

	var dataconnectiononopen = function() {
		peerConnectTime.update(function() {
			dataConnection.close();
			$("#peerconnect").text('Connecting to peer took (ms): ' + peerConnectTime.getStats());
			$("#peerconnectsamples").text('sample ' + peerConnectTime.getNumSamples() + '/' + peerConnectCnt);

			if(peerConnectTime.getNumSamples() < peerConnectCnt) {
				setTimeout(function() {
					peerConnectTime.setPingTime();
					dataConnection = peer.connect(id);
					dataConnection.on('open', dataconnectiononopen);
				}, 1000);
			} else {
				rttBenchmark(dataConnection);
			}
		});
	};

	dataConnection.on('open', dataconnectiononopen);
};

var rttBenchmark = function(dataConnection) {
	dataConnection.removeAllListeners('data');

	dataConnection.on('data', function(data) {
		peerRTT.update(function() {
			$("#rtt").text('RTT to peer (ms): ' + peerRTT.getStats());
			$("#rttsamples").text('sample ' + peerRTT.getNumSamples() + '/' + rttCnt);

			if(peerRTT.getNumSamples() < rttCnt) {
				setTimeout(function() {
					peerRTT.setPingTime();
					dataConnection.send('ping');
				}, 25);
			} else {
				dataConnection.removeAllListeners('data');

				throughputBenchmark(dataConnection);
			}
		});
	});

	peerRTT.setPingTime();
	dataConnection.send('ping');
};

var throughputBenchmark = function(dataConnection) {
	dataConnection.removeAllListeners('data');

	var chunkSize = 1024 * 1024;
	var chunk = new Uint8Array(chunkSize);
	var chunkAck = 0;
	var curChunk = 0;
	var chunkConcurrency = 3;

	var throughputStart = new Date().getTime();

	var chunkSend = function() {
		curChunk++;
		dataConnection.send(chunk);
	}

	dataConnection.on('data', function(data) {
		chunkAck++;

		$("#throughput").text('Data throughput to peer (MB/s): ' +
			Math.round(100 * (chunkAck
			/ ((new Date().getTime() - throughputStart) / 1000))) / 100);

		// send more data
		chunkSend();
	});

	for (var i = 0; i < chunkConcurrency; i++)
		chunkSend();

	var throughputUpdateTimer = setInterval(function() {
		$("#throughputsamples").text('seconds left: ' +
			Math.round(throughputTime - (new Date().getTime() - throughputStart)));
	}, 1000);

	setTimeout(function() {
		dataConnection.removeAllListeners('data');
		clearInterval(throughputUpdateTimer);

		done(dataConnection);
	}, throughputTime);
};

var done = function(dataConnection) {
	$("#done").text('All done!');
	dataConnection.send({reload: true});
};
