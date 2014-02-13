/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */
var System = require("./lib/system").init('reflector');
var Service = require('../lib/service.js');
var spawn = require('../commons/modSpawn.js');
var phantom = require('phantomjs');
var path = require("path");
var events = require('events');
var service = new Service(mainLoop);

module.exports = service;

var INTENSE = 400; // time throttle
var thumbSizes = System.conf.thumbSizes;

var flow = new events.EventEmitter();

flow.on("reflect", function (token) {
    __doRender(phantom.path, [
        // legacy options, don't ask me
        "--ignore-ssl-errors=true",
        "--load-images=true",
        "--local-storage-path=" + path.join(__dirname, "/../../assets/"),
        "--local-to-remote-url-access=true",
        "--script-encoding=utf8",
        "--output-encoding=utf8",
        path.join(__dirname, 'phantom-call.js'),
        token,
        path.join(__dirname, "/../../assets/mailreflection/" + token + ".html"),
        path.join(__dirname, "/../../assets/mailthumbs/")
    ]);
});


service.on('request:reflect', function (deferred, token) {
    System.redis.rpush("reflections_queue", token);
    deferred.resolve(Date.now());
});


function mainLoop(service) {
    System.redis.lpop('reflections_queue', function (err, token) {
        if (err) return console.log(err);

        if (token) flow.emit('reflect', token);

        service.immediate(INTENSE);
    });
}

function __spawnImageMagic(opts) {
    System.imagemagick.resize({
        srcPath: opts.src,
        dstPath: opts.dest,
        width  : opts.width,
        height : opts.height
    }, function (err) {
        if (err) console.error(err.stack || err);
    });
}


function __doRender(cmd, args) {
    return new spawn(cmd, args)
        .on("ready",function (thisChild, spawnedID) {
            console.log("Has Spawned: " + spawnedID);
        }).on("message",function (thisChild, message) {
            console.log(thisChild.id + ": ", message.toString());
            var msg = JSON.parse(message);
            // bug fix
            if (typeof msg.path === "undefined") return;

            System.redis.hset("reflections", msg.token, msg.path);

            storeMessageReflectionFull(msg);

            for (var i = 0; i < thumbSizes.length; i++) {
                __spawnImageMagic({
                    src   : path.join(__dirname, "/../../assets/mailthumbs", msg.path + ""),
                    dest  : path.join(__dirname, "/../../assets/thumbs", msg.path.replace("full", thumbSizes[i][0] + "x" + thumbSizes[i][1])),
                    width : thumbSizes[i][0],
                    height: thumbSizes[i][1]
                });

                storeMessageReflection(msg, i);
            }
        }).on("error",function (thisChild) {
            // kill it so it'll enter in the reSpawn pipe
            thisChild.exit();
        }).on("exit", function () {
            //console.log("Child exit: ", cmd, message);
        });
}

function storeMessageReflectionFull(msg) {
    return System.modQuery.newModQuery()
    .executeSQL('' +
    'INSERT INTO message_reflections VALUES("", (SELECT `id` from `users_inbox` WHERE `messageId` = "' + msg.token + '"), ' +
    '"' + msg.token + '", "full", "' + msg.path + '" );',
    function (rows, err, sql) {
        if (err) console.log(sql, err);
    });
}

function storeMessageReflection(msg, i) {
    return System.modQuery.newModQuery()
    .executeSQL('' +
    'INSERT INTO message_reflections VALUES("", (SELECT `id` from `users_inbox` WHERE `messageId` = "' + msg.token + '"), ' +
    '"' + msg.token + '", "' + thumbSizes[i][0] + "x" + thumbSizes[i][1] + '", ' +
    '"' + msg.path.replace("full", thumbSizes[i][0] + "x" + thumbSizes[i][1]) + '" );',
    function (rows, err, sql) {
        if (err) console.log(sql, err);
    });
}
