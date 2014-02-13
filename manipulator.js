/**
 * Author:      Evangelos Pappas
 * description:
 *
 */
var System = require("./lib/system").init('transmitter');
var modQ = require("../commons/modQuery.js");
var redis = require("redis");
var solr = require('solr-client');

var redisSub = redis.createClient();

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

System.nodeRedis = redis;
System.redis = redis.createClient();
System.manipulator = require('./services/manipulator');
System.solr = solr.createClient(System.conf.solr);
System.modQuery = new modQ({
    dbArgs: System.conf.mysql
});

redisSub.on("subscribe", function (channel) {
    System.redis.publish("logger", "Manipulator::is active", channel);
});
redisSub.on("message", function (channel, uKey) {
    System.manipulator.request('manipulate', uKey, function(now) {
        return now;
    });
});
redisSub.subscribe("newMessage");
