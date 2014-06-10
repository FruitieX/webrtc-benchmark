/*
 * Copyright (c) 2014 Aalto University
 * Copyright (c) 2014 Rasmus Eskola
 * Licensed under the MIT License, see LICENSE for more information.
 */

var serverConnect = function() {
	return new Peer('server', {
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

var peer = serverConnect();

var peeronopen = function() {
	$("#peerid").text("Peer ID: " + peer.id);
};

$("#peerid").text("Connecting...");
peer.on('open', peeronopen);

peer.on('connection', function(dataConnection) {
	dataConnection.on('data', function(data) {
		if(data.reload) {
			console.log('reloading');
			location.reload();
		}

		dataConnection.send('ack');
	});
});
