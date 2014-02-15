/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */
var System = require("./lib/system");
var Service = require('../lib/service.js');
var service = new Service(mainLoop);
var INTENSE = 200; // time throttle

var reflector = require('../interceptors/reflector');

module.exports = service;

service.on('request:reflect', function (deferred, token) {
    System.redis.rpush("reflections_queue", token);
    deferred.resolve(Date.now());
});


function mainLoop(service) {
    System.redis.lpop('reflections_queue', function (err, token) {
        if (err) return console.log(err);

        if (token) reflector.emit('reflect', token);

        service.immediate(INTENSE);
    });
}
