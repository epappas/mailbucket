/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */
var System = require("./lib/system").init('reflector');
var modQ = require("../commons/modQuery.js");
var imagemagick = require('imagemagick');
var path = require("path");
var redis = require("redis");
var redisSub = redis.createClient();

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

System.nodeRedis = redis;
System.redis = redis.createClient();
System.modQuery = new modQ({
    dbArgs: System.conf.mysql
});

// Bug Fix
if (process.platform === 'win32') {
    imagemagick.convert.path = path.join("C:/Program Files (x86)/ImageMagick-6.8.5-Q16", "convert.exe");
}

System.imagemagick = imagemagick;

redisSub.on("subscribe", function (channel, count) {
    System.redis.publish("logger", "Reflector::is active", channel, count);
});
redisSub.on("message", function (channel, token) {
    console.log("Reflector triggered " + channel + ": " + token);
    System.reflector.request('reflect', token, function(now) {
        return now;
    });
});
redisSub.subscribe("reflectMessage");

System.reflector = require('./services/reflector');
System.reflector.start();
