/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */
var System = require("./lib/system");
var parse = require("../commons/modParse.js");
var PipeLine = require("../commons/pipeLine.js").pipeLine;
var path = require("path");
var fs = require('fs');


module.exports = (function (jadeFrames) {

    var redis = System.redis;
    var modQuery = System.modQuery;

    function __spinCollect(messageBucket, aggrFlow, callback) {
        for (var i = 0; i < messageBucket.length; ++i) {
            (function (index) {
                var __this = this;
                aggrFlow.then(function (__pipe, arg) {
                    var str = arg[0];
                    redis.hget("reflections", __this.token, function (err, reflection) {
                        var imgUrl = "http://mailbucket.com/assets/mailthumbs/" + (reflection || "default.png");
                        var text = __this.text.split(/\W+/, 15).slice(0, 15).join(" ");
                        __pipe.proceed(function (index) {
                            var jade = (((index + 1) % 2) === 0 ? "inner-even" : "inner-odd");
                            str += jadeFrames[jade]({
                                img  : imgUrl,
                                text : text,
                                by   : __this.from,
                                title: __this.subject,
                                url  : "http://mailbucket.com/#/message/" + __this.token,
                                index: index
                            });
                            return str;
                        }(index));
                        if (callback) {
                            __this.index = index;
                            __this.text = text;
                            __this.imgUrl = imgUrl;
                            callback(__this);
                        }

                    });
                });
            }).call(messageBucket[i], i);
        }
    }

    function __streamToFile(source, path, callback) {
        var outStream = fs.createWriteStream(path, {flags: 'w'});
        outStream.once('open', function (fd) {
            for (var i = 0; i < source.length; i += 1024) {
                if ((i + 1024) < source.length) {
                    outStream.write(source.slice(i, i + 1024));
                }
                else {
                    outStream.write(source.slice(i, source.length));
                    outStream.end(function () {
                        if (callback) {
                            callback();
                        }
                    });
                }
            }
        });
    }

    function __monitor(key, obj) {
        redis.lpush(key, JSON.stringify(obj));
        return this;
    }

    return function (token, email, messageBucket) {
        var str = "";
        var mStart = Date.now();
        var insertQ = modQuery.newModQuery();
        var aggrFlow = new PipeLine(); // Pipes FTW!

        __spinCollect(messageBucket, aggrFlow, function (__this) {
            insertQ.insertInto("users_aggregations_messages")
                .insert("aggr_id", "(SELECT `id` from `users_aggregations` WHERE `key` = \"" + email.token + "\")")
                .insert("aggr_key", email.token)
                .insert("messageId", __this.token + "")
                .insert("`index`", __this.index)
                .insert("sender", parse.toDB(__this.from))
                .insert("title", parse.toDB(__this.subject))
                .insert("`excerpt`", parse.toDB(__this.text))
                .insert("thumb", parse.toDB(__this.imgUrl))
                .addParallel(); // other row
        });

        aggrFlow.then(function (__pipe, arg) {
            var str = arg[0];
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
                strMId     : "http://mailbucket.com/#/collection/" + email.token + ""
            });
            var emailJSON = JSON.stringify(email);
            redis.rpush("out", emailJSON);
            //redis.publish("newMail", emailJSON);
            redis.publish("logger", "Aggregator::User " + email.uKey + " - " + email.to);
            redis.publish("logger-aggregator", email.token);
            __streamToFile(email.html, path.join(__dirname, "/../../assets/aggregations/" + email.messageId + ".html"));
            modQuery.newModQuery()
                .insertInto("users_aggregations")
                .insert("`key`", email.token)
                .insert("`user_key`", email.uKey)
                .insert("`user_id`", "(SELECT `id` from `users` WHERE `key` = \"" + email.uKey + "\")")
                .insert("`interval`", Date.now())
                .insert("`path`", path.join(__dirname, "/../../assets/aggregations/" + email.messageId + ".html"))
                .execute(function (rows, err, sql) {
                    if (err) {
                        console.log(sql);
                        console.log(err);
                        return;
                    }
                    insertQ.execute(function (rows, err, sql) {
                        if (err) {
                            console.log(sql);
                            console.log(err);
                        }
                        __monitor("aggregate", {
                            uKey     : email.uKey,
                            messageId: email.token,
                            start    : mStart,
                            time     : Date.now() - mStart,
                            error    : ""
                        });
                    });
                });
        }).proceed(str);
    };
});
