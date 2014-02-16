/**
 * Author:      Evangelos Pappas
 * description:
 *
 */
var System = require("./lib/system").init('receiver');
var express = require('express');
var app = express();
var redis = require("redis");
var redisStore = redis.createClient();

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

// globalize
System.nodeRedis = redis;
System.redis = redis.createClient();

app.configure(function () {

    app.use(express.methodOverride());
    app.use(express.bodyParser());
    app.use(express.logger('dev'));
    app.use(express.responseTime());
    app.use(express.compress());
    app.use(express.json());
    app.use(express.urlencoded());

    app.disable('x-powered-by');
    app.use(function(req, res, next) {
        res.removeHeader("x-powered-by");
        next();
    });

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
app.on('listening', function () {
    console.log('Listening on port %s at %s', app.address().port, app.address().address);
});

/* SOLVES THE CORS PROBLEM */
app.all('/*', function (req, res, next) {
    var env = (System.conf.app.dev === true) ? System.conf.app.devUrl : app.url;
    res.header("Access-Control-Allow-Origin", env);
    res.header("Access-Control-Allow-Headers", 'Content-Type, X-Requested-With');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

/**
 * handle OPTIONS requests from the browser
 */
app.options("*", function (req, res) {
    res.send(200);
    res.end();
});

app.all('/test', function (req, res) {
    redisStore.publish("logger", "Receiver::test ignited");
    res.send({
        status: "Ok ",
        live  : process.uptime(),
        inUse : process.memoryUsage()
    });
    res.end();
});


// IOC routes' initiation
System.initRoutes(app);
app.listen(System.conf.port);

console.log('Listening on http://0.0.0.0:' + System.conf.port);
