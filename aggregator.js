/**
 * Author:      Evangelos Pappas
 * description:
 *
 */
var System = require("./lib/system").init('aggregator');
var modQ = require("../commons/modQuery.js");
var uuid = require("../commons/modUUID.js");
var events = require('events');
var PipeLine = require("../commons/pipeLine.js").pipeLine;
var redis = require("redis");
var fs = require('fs');
var jade = require("jade");

var redisSub = redis.createClient();
var redisSub2 = redis.createClient();
var duotriUuid = uuid.get('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

System.modAggregator = require("./modAggregator.js");
System.nodeRedis = redis;
System.redis = redis.createClient();
System.System.modQuery = new modQ({
    dbArgs: System.conf.mysql
});

var flow = new events.EventEmitter();
var jadeFrames = {};

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

redisSub.on("subscribe", function (channel, count) {
    System.redis.publish("logger", "Aggregator::is active", channel, count);
});
redisSub.on("message", function (channel, uKey) {
    console.log("Aggregator triggered " + channel + ": " + uKey);
    flow.emit('aggregate', uKey);
});
redisSub.subscribe("aggregate-user");

flow.on("aggregate", function (uKey) {
    //var token = new mNode.uuid().getUuid();
    var token = duotriUuid.get();
    var messageBucket = [];
    var email = {
        token    : token,
        uKey     : uKey,
        messageId: token + "." + uKey,
        subject  : "Your Daily MailDigest",
        from     : "Mailbucket digest <notifications@mailbucket.com>",
        name     : "",
        surname  : "",
        mail     : "",
        to       : [],
        html     : ""
    };
    var aggregator = System.modAggregator(jadeFrames);

    console.info(uKey + "-" + token + "@" + Date.now());
    System.redis.hget("users_repo", uKey, function (err, result) {
        var user = JSON.parse(result);
        email.to = [user.email];
        email.mail = user.email;
        email.name = user.name;
        email.surname = user.surname;
        aggregateLoop();
    });
    function aggregateLoop() {
        System.redis.lpop(uKey + "_aggr", function (err, message) {
            if (err) {
                console.error("Aggregator Error " + uKey);
                console.error(err);
                return;
            }

            if (message !== null) {
                // a hack to stabilize message's structure
                messageBucket.push((function (uKey) {
                    return {
                        token    : this.token ? this.token : "",
                        uKey     : uKey,
                        messageId: (this.token ? this.token : ""), //+ "." + uKey,
                        subject  : this.subject ? this.subject : "",
                        from     : this.from ? this.from : "",
                        name     : this.name ? this.name : "",
                        surname  : this.surname ? this.surname : "",
                        to       : [this.to ? this.to : ""],
                        html     : (this.body ? this.body : ""),
                        text     : (this.bodyParsed ? this.bodyParsed : "")
                    };
                }).call(JSON.parse(message), uKey));
                process.nextTick(aggregateLoop);
            }
            else {
                // fastest exit
                if (messageBucket.length <= 0) {
                    return;
                }
                // Remember - void single thread violation
                process.nextTick(function () {
                    aggregator(token, email, messageBucket);
                });
            }
        });
    }
});

redisSub2.on("message", function (channel, message) {
    mainLoop(1, message);
});
redisSub2.subscribe("aggregate-now");

init(function () {
    mainLoop(INTENSE); // intensive polling
});
function init(callback) {
    System.redis.hkeys("users_repo", function (err, results) {
        var listPipe = new PipeLine();
        for (var i = 0; i < results.length; ++i) {
            (function (uKey) {
                listPipe.then(function () {
                    System.redis.hget("users_repo", uKey, function (err, result) {
                        var user = JSON.parse(result);
                        System.redis.zscore('users_intervals', user._key, function (err, result) {
                            if (!result) {
                                System.redis.zadd('users_intervals', now() + parseInt(user.interval, 10), user._key);
                            }
                        });
                    });
                });
            }).call(null, results[i]);
        }
        listPipe.then(function () {
            System.redis.publish("logger", "Aggregator::Created users_intervals");
            console.log("Aggregator is running");
            process.nextTick(initTemplates.bind(null, callback));
        }).start();
    });
    function now() { return parseInt(Date.now() / 1000, 10); }
}
var INTENSE = 1000; // time throttle
var lastInterval = null;
function mainLoop(interval) {
    clearInterval(lastInterval);
    lastInterval = setTimeout(function (/*user*/) {
        System.redis.zrange('users_intervals', 0, 0, 'WITHSCORES', function (err, values) {
            interval = INTENSE; // return to intensive polling
            if (err) {
                console.log("Aggregator Error ");
                console.log(err);
                return;
            }
            if (values.length > 0) {
                var uKey = values[0];
                var t = parseInt(values[1], 10) - now();
                if (t <= 0) {
                    // Begin user's aggregation and re-pool to aggregation queue
                    flow.emit('aggregate', uKey);
                    System.redis.zrem('users_intervals', uKey, function () {
                        System.redis.hget("users_repo", uKey, function (err, result) {
                            var user = JSON.parse(result);
                            System.redis.zadd('users_intervals', now() + parseInt(user.interval, 10), user._key);
                        });
                    });
                }
                else {
                    interval = t * 1000; // void intense polling
                }
            }
            process.nextTick(function () {
                mainLoop(interval);
            });
        });
    }, interval, null);

    function now() { return parseInt(Date.now() / 1000, 10); }
}
function initTemplates(callback) {
    var jadePath = "../assets/jade/";
    fs.readdir(jadePath, function (err, files) {
        if (err) {
            console.log(err);
            return err;
        }
        for (var i = files.length; i--;) {
            var path = jadePath + files[i];
            if (files[i].match(/.+(\.jade)$/)) {
                jadeFrames[files[i].replace(".jade", "")] = jade.compile(fs.readFileSync(path, 'utf8'), { filename: path, pretty: true });
            }
        }
        process.nextTick(callback);
    });
}
