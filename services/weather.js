var Service = require('../lib/service.js');
var Q = require('q');
var request = require('request');
var service = new Service(weatherService);

module.exports = service;

service.on('request:lastWeather', function(deferred) {
    service.store.get('lastWeather', function(err, weather) {
        deferred.resolve(weather);
    });
});

function weatherService(service, value) {
    Q.nfcall(request, { url:'http://api.openweathermap.org/data/2.5/weather?q=London,uk', json: true })
    .then(function(resp) {
        return (resp[0] || {}).body;
    })
    .then(service.hook('gotWeather'))
    .then(service.notify())
    .then(function(weather) {
        weather.test2 = 42;

        service.store.set('lastWeather', weather);

        return weather;
    })
    .then(service.wireTap('done'))
    // .then(service.nextTick(Q(123)))
    // .then(service.nextTick(Q(false)))
    .then(service.nextTick(1000))
    // .then(service.nextTick(false))
    // .then(service.nextTick(function(isOK) { isOK(true); }))
    // .then(service.nextTick(function(isOK) { isOK(false); }))
    .fail(function(err) {
        console.log(err, err.stack);
    });
}

