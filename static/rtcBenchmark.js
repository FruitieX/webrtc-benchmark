var serverCnt = 50; // how many times we connect to the server
var peerListCnt = 400; // how many samples to collect
var peerConnectCnt = 100; // how many samples to collect
var rttCnt = 1000; // how many samples to collect

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

serverConnectTime.setPingTime();
var peer = serverConnect();

var peeronopen = function() {
	if(serverConnectTime.getNumSamples() < serverCnt) {
		serverConnectTime.update(function() {
			$("#server").text('Connection to server took (ms): ' + serverConnectTime.getStats());
			$("#serversamples").text('sample ' + serverConnectTime.getNumSamples() + '/' + serverCnt);

			peer.disconnect();
			setTimeout(function() {
				serverConnectTime.setPingTime();
				peer = serverConnect();
				peer.on('open', peeronopen);
			}, 500);
		});
	} else {
		$("#peerid").text("Peer ID: " + peer.id);

		peerList();
	}
};

peer.on('open', peeronopen);

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
			}, 10);
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
	var dataConnection = peer.connect(id);

	var dataconnectiononopen = function() {
		peerConnectTime.update(function() {
			$("#peerconnect").text('Connecting to peer took (ms): ' + peerConnectTime.getStats());
			$("#peerconnectsamples").text('sample ' + peerConnectTime.getNumSamples() + '/' + peerConnectCnt);

			if(peerConnectTime.getNumSamples() < peerConnectCnt) {
				setTimeout(function() {
					dataConnection.close();
					peerConnectTime.setPingTime();
					dataConnection = peer.connect(id);
					dataConnection.on('open', dataconnectiononopen);
				}, 10);
			} else {
				rttBenchmark(dataConnection);
			}
		});
	};

	peerConnectTime.setPingTime();
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
				}, 10);
			} else {
				dataConnection.removeAllListeners('data');

				done(dataConnection);
			}
		});
	});

	peerRTT.setPingTime();
	dataConnection.send('ping');
};

var done = function(dataConnection) {
	$("#done").text('All done!');
};
