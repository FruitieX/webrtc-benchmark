/*
 * Copyright (c) 2014 Aalto University
 * Copyright (c) 2014 Rasmus Eskola
 * Licensed under the MIT License, see LICENSE for more information.
 */

// how many samples to gather from the various tests
var serverCnt = 50;
var peerListCnt = 200;
var peerConnectCnt = 50;
var rttCnt = 3000;
var MBCnt = 128; // how many MB to send in throughput test

var serverConnect = function(id) {
	return new Peer(id, {
		host: '192.168.1.248',
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
	var avg = 0; var stddev = 0;
	var jitter = 0; var min = 999999999; var max = 0; var samples = 0;
	var times = []; var jitters = [];
	var pingTime;

	this.getStats = function() {
		return '<td>' + avg + '</td><td>' + min + '</td><td>' + max +
			'</td><td>' + stddev + '</td><td>' + jitter + '</td>';
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

		// standard deviation
		var tempSum = 0;
		for(var i = 0; i < times.length; i++) {
			tempSum += Math.pow(times[i] - avg, 2);
		}
		stddev = tempSum / times.length;
		stddev = Math.sqrt(stddev);

		avg = Math.round(avg * 100) / 100;
		stddev = Math.round(stddev * 100) / 100;

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
			$("#server").html('<td>Connection to server took (ms)</td>' + serverConnectTime.getStats());
			$("#samples").text('sample ' + serverConnectTime.getNumSamples() + '/' + serverCnt);

			peer.destroy();
			setTimeout(function() {
				serverConnectTime.setPingTime();
				peer = serverConnect();
				peer.on('open', peeronopen);
			}, 750);
		});
	} else {
		$("#peerid").text("Peer ID: " + peer.id);
		$("#samples").empty();

		peerList();
	}
};

var onlistpeers = function() {
	peerListTime.update(function() {
		$("#peerlist").html('<td>Listing peers took (ms)</td>' + peerListTime.getStats());
		$("#samples").text('sample ' + peerListTime.getNumSamples() + '/' + peerListCnt);

		if(peerListTime.getNumSamples() < peerListCnt) {
			setTimeout(function() {
				peerListTime.setPingTime();
				peer.listAllPeers(function(peers) {
					onlistpeers();
				});
			}, 100);
		} else {
			$("#samples").empty();
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
	var dataConnection = peer.connect(id, {reliable: true});

	var dataconnectiononopen = function() {
		peerConnectTime.update(function() {
			$("#peerconnect").html('<td>Connecting to peer took (ms)</td>' + peerConnectTime.getStats());
			$("#samples").text('sample ' + peerConnectTime.getNumSamples() + '/' + peerConnectCnt);

			if(peerConnectTime.getNumSamples() < peerConnectCnt) {
				setTimeout(function() {
					dataConnection.close();

					peerConnectTime.setPingTime();
					dataConnection = peer.connect(id);
					dataConnection.on('open', dataconnectiononopen);
				}, 1000);
			} else {
				$("#samples").empty();
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
			$("#rtt").html('<td>RTT to peer (ms)</td>' + peerRTT.getStats());
			$("#samples").text('sample ' + peerRTT.getNumSamples() + '/' + rttCnt);

			if(peerRTT.getNumSamples() < rttCnt) {
				setTimeout(function() {
					peerRTT.setPingTime();
					dataConnection.send('ping');
				}, 25);
			} else {
				dataConnection.removeAllListeners('data');
				$("#samples").empty();

				throughputBenchmark(dataConnection);
			}
		});
	});

	peerRTT.setPingTime();
	dataConnection.send('ping');
};

var throughputBenchmark = function(dataConnection) {
	dataConnection.removeAllListeners('data');

	var chunkSize = 1024 * 1024 * MBCnt;
	var chunk = new Uint8Array(chunkSize);

	$("#throughput").html('<td>Measuring data throughput by sending ' + MBCnt + ' MB...</td>');
	var throughputStart = new Date().getTime();

	var chunkSend = function() {
		dataConnection.send(chunk);
	}

	dataConnection.on('data', function(data) {
		$("#throughput").html('<td>Data throughput to peer (MB/s)</td><td>' +
			Math.round(100 * (MBCnt
			/ ((new Date().getTime() - throughputStart) / 1000))) / 100 + '</td>');
		done(dataConnection);
	});
	chunkSend();
};

var done = function(dataConnection) {
	$("#done").text('All done!');
	dataConnection.send({reload: true});
};
