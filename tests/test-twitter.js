var twitterService = require('../services/twitterService');

var runtime = twitterService.start();

runtime.on('progress', function(tweet, now) {
    console.log('tweet', now, tweet.id, tweet.text);
});

