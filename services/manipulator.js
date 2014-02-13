var System = require("./lib/system");
var Service = require('../lib/service.js');
var modM = require("./modManipulator.js");
var fs = require('fs');
var jade = require("jade");
var service = new Service();

var jadeFrames = { };

var interceptor = modM(jadeFrames);

module.exports = service;

service.on('request:manipulate', function (deferred, uKey) {
    manipulate(uKey, function() {
        deferred.resolve(Date.now());
    });
});


function manipulate(uKey, callback) {
    System.redis.lpop(uKey + "_in", function (err, message) {
        if (err) {
            console.err("Manipulator Error " + uKey);
            console.err(err);
            return;
        }
        if (!message) {
            return callback();
        }
        interceptor(JSON.parse(message), uKey, function () {
            // recurse until user's waiting inbox is empty
            setTimeout(manipulate.bind(null, uKey, callback), 1);
        });
    });
}


(function () {
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
    });
})();
