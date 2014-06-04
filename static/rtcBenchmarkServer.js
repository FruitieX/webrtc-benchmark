var serverConnect = function() {
	return new Peer('server', {
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

var peer = serverConnect();

var peeronopen = function() {
	$("#peerid").text("Peer ID: " + peer.id);
};

peer.on('open', peeronopen);

peer.on('connection', function(dataConnection) {
	dataConnection.on('data', function(data) {
		dataConnection.send('ack');
	});
});
