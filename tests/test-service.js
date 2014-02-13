var weatherService = require('../services/weather');

var runtime = weatherService.start(function(condition) {
    console.log('Waiting...');
    setTimeout(function() {
        condition(true);
    }, 1);
});

runtime.on('gotWeather', function(promise) {
    promise.then(function(weather) {
        weather.test = 1234;
        return weather;
    });
});

runtime.on('done', function(weather) {
    void(weather);
});

runtime.on('progress', function(weather, now) {
    console.log('progress', now, weather.id);
});


setTimeout(function loop() {
    runtime.request('lastWeather', function(lastWeather) {
        // do something with lastWeather
        console.log('loop: ', lastWeather.id);
        return lastWeather;
    })
    .then(function() {
        setTimeout(loop, 3000);
    });
}, 3000);

