/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */
var System = require("../lib/system");
var path = require("path");
var fs = require('fs');
var model = require("../modules/aggregations");


module.exports = (function (jadeFrames) {

    var redis = System.redis;

    function __spinCollect(token, messageBucket, callback) {
        var str = "";
        messageBucket.forEach(function (message, index, arr) {
            // TODO - (optimize this) this doesn't respect the async direc. flow
            redis.hget("reflections", message.token, function (err, reflection) {
                var imgUrl = System.conf.assets.urlMailthumbs + (reflection || "default.png");
                var text = message.text.split(/\W+/, 15).slice(0, 15).join(" ");

                var jade = (((index + 1) % 2) === 0 ? "inner-even" : "inner-odd");
                str += jadeFrames[jade]({
                    img  : imgUrl,
                    text : text,
                    by   : message.from,
                    title: message.subject,
                    url  : System.conf.assets.urlMessage + message.token,
                    index: index
                });

                message.index = index;
                message.text = text;
                message.imgUrl = imgUrl;
                // TODO - (optimize this) this doesn't respect the async direc. flow
                model.storeAggregationDetail(token, message);

                if (index === arr.length - 1 && callback) {
                    callback(str);
                }
            });
        });
    }

    function __streamToFile(source, path, callback) {
        var outStream = fs.createWriteStream(path, {flags: 'w'});
        callback = callback || function() { };

        outStream.once('open', function () {
            for (var i = 0; i < source.length; i += 1024) {
                if ((i + 1024) < source.length) {
                    outStream.write(source.slice(i, i + 1024));
                }
                else {
                    outStream.write(source.slice(i, source.length));
                    outStream.end(callback);
                }
            }
        });
    }
    return function (token, email, messageBucket) {

        __spinCollect(token, messageBucket, function (str) {
            var d = new Date();
            email.html = jadeFrames['default']({
                text       : str,
                title      : email.subject,
                mail       : email.mail,
                name       : email.name,
                surname    : email.surname,
                fullName   : email.name + " " + email.surname,
                nowDate    : d.getUTCDate() + "/" + d.getUTCMonth() + "/" + d.getUTCFullYear(),
                nowDateTime: d.getUTCDate() + "/" + d.getUTCMonth() + "/" + d.getUTCFullYear() + " " + d.getUTCHours() + ":" + d.getUTCMinutes(),
                mId        : email.messageId,
                strMId     : System.conf.assets.urlCollection + email.token + ""
            });
            var emailJSON = JSON.stringify(email);
            redis.rpush("out", emailJSON);
            //redis.publish("newMail", emailJSON);
            redis.publish("logger", "Aggregator::User " + email.uKey + " - " + email.to);
            redis.publish("logger-aggregator", email.token);

            __streamToFile(email.html, path.join(__dirname, System.conf.assets.aggregationPath + email.messageId + ".html"));

            model.storeAggregation(email);
        });
    };
});
