/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */
var System = require("./lib/system");
var mediator = require("../lib/mediator");
var phantom = require('phantomjs');
var spawn = require('../commons/modSpawn.js');
var path = require("path");
var model = require("../modules/reflections");

var thumbSizes = System.conf.thumbSizes;
var assetsPath = System.conf.assets.path;

var reflector = module.exports = mediator.extent("reflector");

reflector.subscribe("reflect", function (token) {
    __doRender(phantom.path, [
        // legacy options, don't ask me
        "--ignore-ssl-errors=true",
        "--load-images=true",
        "--local-storage-path=" + path.join(__dirname, assetsPath),
        "--local-to-remote-url-access=true",
        "--script-encoding=utf8",
        "--output-encoding=utf8",
        path.join(__dirname, 'phantom-call.js'),
        token,
        path.join(__dirname, assetsPath + "/mailreflection/" + token + ".html"),
        path.join(__dirname, assetsPath + "/mailthumbs/")
    ]);
});


function __doRender(cmd, args) {
    return new spawn(cmd, args)
    .on("message",function (thisChild, message) {
        var msg = JSON.parse(message);
        // bug fix
        if (typeof msg.path === "undefined") return;

        model.put(msg);

        for (var i = 0; i < thumbSizes.length; i++) {
            __spawnImageMagic({
                src   : path.join(__dirname, assetsPath + "/mailthumbs", msg.path),
                dest  : path.join(__dirname,
                    assetsPath + "/thumbs",
                    msg.path.replace("full", thumbSizes[i][0] + "x" + thumbSizes[i][1])
                ),
                width : thumbSizes[i][0],
                height: thumbSizes[i][1]
            });

            model.put(msg, thumbSizes[i]);
        }
    }).on("error",function (thisChild) {
        // kill it so it'll enter in the reSpawn pipe
        thisChild.exit();
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
