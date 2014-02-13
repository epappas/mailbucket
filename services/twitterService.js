var System = require("../lib/system");
var Service = require('../lib/service');
var Twitter = require('twitter');
var service = new Service(twitterService);
var myStream = null;

module.exports = service;

service.on('request:stream', function(deferred) {
    deferred.resolve(myStream);
});

function twitterService(service) {

    var terms = ['java', 'javascript', 'scala'];

    new Twitter({
        consumer_key: System.conf.twitter.consumerKey,
        consumer_secret: System.conf.twitter.consumerSecret,
        access_token_key: System.conf.twitter.accessToken,
        access_token_secret: System.conf.twitter.accessTokenSecret
    })
    .stream('statuses/filter', {
        track: terms.join(',')
    }, function(stream) {
        myStream = stream;
        stream.on('data', onTweet);

        stream.on('error', function(err) {
            console.error(err);
        });

        stream.on('end', function(err) {
            console.error('end', err.statusCode);
            service.immediate(1000);
        });
    });
}

function onTweet(data) {
    if (! data || ! data.text) return;

    service.notify(data);
    service.store.set(System.getUuid(), data);
}
