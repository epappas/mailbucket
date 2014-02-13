// Require dependencies
var express = require('express');
var io = require('socket.io');
var redis = require("redis");
var RedisStore = require('./lib/connect-redis')(express);
var ncache = require("./lib/ncache");
var http = require('http');
var Memcached = require('memcached');
var System = require("./lib/system").init('web');

var user = require("./interceptors/user");

if (typeof setImmediate === "undefined") {
	require('setimmediate');
}
// initiations of clients
var memcached = new Memcached("localhost:11211");
// var redisClient = redis.createClient();
var port = (process.env.PORT || System.conf.port);
var app = express();
var server = http.createServer(app);
var memoryCache = ncache.mCache();
var mkeyCache = ncache.memcached({
	connection: memcached
});

// globalize
System.memoryCache = memoryCache;
System.mkeyCache = mkeyCache;
System.memcached = memcached;
System.redis = redis;
System.auth = user.auth(express);

process.on("uncaughtException", function (err) {
	console.log(err, err.stack);
	process.exit();
});

//Setup Express
app.configure(function() {
	app.use(express.methodOverride());
	app.use(express.bodyParser());
	app.use(express.logger('dev'));
	app.use(express.responseTime());
	app.use(express.compress());
	app.use(express.json());
	app.use(express.urlencoded());

	app.use(express.cookieParser());
	app.use(express.session({
		secret: 'secret',
		store: new RedisStore()
	}));

	app.disable('x-powered-by');
	app.use(function(req, res, next) {
		res.removeHeader("x-powered-by");
		next();
	});

	app.use('/', express.static(__dirname + '/public'));
	app.use(express.directory(__dirname + '/public'));
	app.use(express.static(__dirname + '/public'));

	app.use(user.untokenizeReq); // token-session decode pattern
	app.use(app.router);
	app.use(function(req, res) {
		res.writeHead(404, {
			'Content-Type': 'application/json'
		});
		res.write(JSON.stringify({
			code: 404,
			message: "Request Not Found"
		}));
		res.end();
	});
});

// SOLVES THE CORS PROBLEM
app.all('/*', function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "localhost");
	res.header("Access-Control-Allow-Headers", 'Content-Type, X-Requested-With');
	res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.header('Access-Control-Allow-Credentials', 'true');
	next();
});

/**
 * handle OPTIONS requests from the browser
 */
app.options("*", function(req, res) {
	res.send(200);
});

// IOC routes' initiation
System.initRoutes(app);

app.listen(port);

//Setup Socket.IO
io.listen(server).sockets.on('connection', function(socket) {
	console.log('Client Connected on WS');
	socket.on('message', function(data) {
		console.log('WS received :', data);
		//socket.broadcast.emit('server_message', data);
		//socket.emit('server_message', data);
	});
	socket.on('disconnect', function() {
		console.log('Client Disconnected.');
	});
});


///////////////////////////////////////////
//              Routes                   //
///////////////////////////////////////////

app.all('/status', function(req, res) {
	res.send({
		state: "running"
	});
	res.end();
});

console.log('Listening on http://0.0.0.0:' + port);

