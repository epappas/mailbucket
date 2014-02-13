var Q = require("q");
var System = require("../lib/system");
var parse = require("../commons/modParse.js");
var path = require("path");
var fs = require('fs');
var http = require('http');

var DEFAULT_REFLECTION = "default.png";

module.exports = (function (jadeFrames) {

    var modQuery = System.modQuery;
    var redis = System.redis;

    System.solr.autoCommit = true;

    // HACK to fix bug
    System.solr.update = (function (data, callback) {
        var self = this;
        self.options.json = JSON.stringify(data);
        self.options.fullPath = [self.options.path, self.options.core, 'update?commit=' + self.autoCommit + '&wt=json']
            .filter(function (element) {
                if (element) return true;
                return false;
            })
            .join('/');
        __updateRequest(this.options, callback);
        return self;
    }).bind(System.solr);

    function __toSolr(doc) {
        System.solr.add([doc], function (err, obj) {
            if (err) {
                console.log(err);
                return;
            }
            console.log(obj);
        });
    }

    function __toInbox(uKey, message, callback) {
        // Store message to inbox
        return modQuery.newModQuery()
        .executeSQL('' +
        'INSERT INTO users_inbox VALUES("", (SELECT `id` from `users` WHERE `key` = "' + uKey + '"), ' +
        '"' + uKey + '", "' + message.token + '", ' +
        '"' + parse.toDB(message.fromName) + '", ' +
        '"' + parse.toDB(message.fromAddr) + '", ' +
        '"' + parse.toDB(message.receivedAlias) + '", ' +
        '"' + parse.toDB(message.to) + '", ' +
        '"' + parse.toDB(message.subject) + '", ' +
        '"' + parse.toDB(message.bodyParsed) + '", ' +
        '"' + parse.toDB("http://www.mailbucket.com/assets/mailcontent/" + message.token + ".html") + '", ' +
        '"' + parse.toDB(JSON.stringify({headers: message.message.headers, envelope: message.message.envelope})) + '", ' +
        '"' + message.token + '-full.png", 0, ' + message.received + ', 0);',
        function (rows, err, sql) {
            if (err) console.log(sql, err);
            if (callback) callback(err, rows);
        });
    }

    function __applyUserRules(uKey, message, callback) {
        // users_rules
        return modQuery.newModQuery()
        .select()
        .from("users_rules")
        .filterBy("users_rules", "user_key").equals(uKey)
        .execute(function (rows, err, sql) {
            if (err) console.log(sql, err);

            for (var i = 0; i < rows.length; ++i) {
                var rule = new RegExp(rows[i].rule, "gim");
                var sets = JSON.parse(rows[i].settings);
                var check = __check(
                    message.fromName.match(rule),
                    message.fromAddr.match(rule),
                    message.receivedAlias.match(rule)
                );
                if (check) {
                    var bool = false;
                    var usersRules = modQuery.newModQuery();
                    for (var j = 0; j < sets.tags.length; ++j) {
                        bool = true;
                        usersRules
                        .insertInto("tags_items")
                        .insert("id", sets.tags[j])
                        .insert("itemid", "(SELECT id FROM `users_inbox` WHERE `messageId` = \"" + message.token + "\")")
                        .addParallel(); // other row
                    }
                    if (bool) {
                        usersRules.execute(function (rows, err, sql) {
                            if (err) console.log(sql, err);
                            if (callback) callback(err, rows);
                        });
                    }
                }
            }
        });
    }

    function __storeUserSubscription(uKey, message, callback) {
        // store subscription
        return modQuery.newModQuery()
        .insertInto("users_subscriptions")
        .insert("domain", ((message.fromAddr.split("@") || [] )[1] || "").trim())
        .insert("name", message.fromName)
        .insert("user_id", "(SELECT `id` from `users` WHERE `key` = \"" + uKey + "\")")
        .insert("user_key", uKey)
        .onDuplicate()
        .set("name", message.fromName)
        .execute(function (rows, err, sql) {
            if (err) console.log(sql, err);

            var lastId = (rows || {}).insertId;
            modQuery.newModQuery()
            .insertInto("subscriptions_leafs")
            .insert("domain", message.fromAddr)
            .insert("name", message.fromName)
            .insert("sub_id", lastId)
            .onDuplicate()
            .set("name", message.fromName)
            .execute(function (rows, err, sql) {
                if (err) console.log(sql, err);
                if (callback) callback(err, rows);
            });
        });
    }

    function __streamToFile(source, path, callback) {
        var outStream = fs.createWriteStream(path, {flags: 'w'});
        outStream.once('open', function () {
            for (var i = 0; i < source.length; i += 1024) {
                if ((i + 1024) < source.length) {
                    outStream.write(source.slice(i, i + 1024));
                }
                else {
                    outStream.write(source.slice(i, source.length));
                    outStream.end(function () {
                        if (callback) callback(null, {});
                    });
                }
            }
        });
    }

    function __monitor(key, obj) {
        System.redis.lpush(key, JSON.stringify(obj));
        return this;
    }

    function __check() {
        for (var i = 0; i < arguments.length; ++i) {
            if (arguments[i]) {
                return true;
            }
        }
        return false;
    }

    return function (message, uKey, callback) {

        return Q((function() {
            var frm = __filter(this.body, this.bodyParsed);
            // persist schema of message
            return {
                token        : this.token,
                uKey         : this.uKey,
                subject      : this.subject,
                from         : this.from,
                fromName     : ((this.from.split("<") || [] )[0] || "").trim(),
                fromAddr     : ((this.from.split(/[<,>]/) || [] )[1] || "").trim(),
                receivedAlias: (message.message.envelope || {}).to,
                to           : this.to,
                filename     : this.filename,
                recipients   : this.recipients ? this.recipients : [],
                body         : (this.body),
                bodyParsed   : (this.bodyParsed),
                bodyTrimed   : frm,
                bodyEscaped  : parse.escapeNonLatin(frm),
                message      : this.message,
                received     : Math.floor(Date.now() / 1000),
                err          : this.err
            };
        }).call(message))
        .then(function(message) {
            var msg = JSON.stringify();
            return Q.all([
                Q.nfcall(redis.hset.bind(redis), uKey + "_inbox", message.token, msg),
                Q.nfcall(redis.hset.bind(redis), "reflections", message.token, DEFAULT_REFLECTION),
                Q.nfcall(redis.rpush.bind(redis), uKey + "_aggr", msg),
                Q.nfcall(redis.publish.bind(redis), "logger-manipulator", message.token || "")
            ]).
            then(function() {
                return message;
            });
        })
        .then(function(message) {
            var mStart = Date.now();

            return Q.allSettled([
                Q.nfcall(__toInbox, uKey, message),

                Q.nfcall(__applyUserRules, uKey, message),

                Q.nfcall(__storeUserSubscription, uKey, message),

                Q.nfcall(__toSolr, {
                    uKey            : uKey,
                    messageId       : message.token,
                    subject         : message.subject,
                    fromName        : message.fromName,
                    fromAddr        : message.fromAddr,
                    shortBody       : message.bodyParsed,
                    body            : message.bodyTrimed,
                    htmlF_s         : "http://www.mailbucket.com/assets/mailcontent/" + message.token + ".html",
                    thumb_s         : message.token + "-full.png",
                    receivedDatetime: message.received,
                    tags            : []
                }),

                Q.nfcall(__streamToFile,
                    message.bodyEscaped, path.join(__dirname, "/../../assets/mailcontent/" + message.token + ".html")),

                // pump email to repository
                Q.nfcall(__streamToFile, jadeFrames['message']({
                    bodyHTML: message.bodyEscaped,
                    titleMSG: message.subject
                }), path.join(__dirname, "/../../assets/mailreflection/" + message.token + ".html"))
            ])
            .then(function () {
                redis.publish("reflectMessage", message.token || "");

                __monitor("manipulate", {
                    uKey     : uKey,
                    messageId: message.token,
                    start    : mStart,
                    time     : Date.now() - mStart,
                    error    : ""
                });
            });
        })
        .then(callback);
    };
});

function __filter(body, parsed) {
    var str = "";
    var arr = [];
    body = (body || "");
    parsed = (parsed || "");
    arr = body.match(/(<\s*body[^>]*>)(\S|\s|.)+|(<\s*\/\s*body[^>]*\s*>)/gi);
    str = (arr ? arr.join("").replace(/(<\s*body[^>]*>)|(<\s*\/\s*body[^>]*\s*>)|(<\s*\/\s*html[^>]*\s*>)/gi, "")
        : (body ? body : parsed));
    // escape single-line script tags
    str = str.replace(/(<\s*script[^>]*\/>)+/gi, "");
    // escape script tags
    str = str.replace(/(<\s*script[^>]*>)+[\S\s]*(<\s*\/\s*script[^>]*\s*>)+/gi, "");
    // escape single-line style tags
    str = str.replace(/(<\s*style[^>]*\/>)+/gi, "");
    // escape style tags
    str = str.replace(/(<\s*style[^>]*>)+[\S\s]*(<\s*\/\s*style[^>]*\s*>)+/gi, "");
    return str;
}
function __updateRequest(params, callback) {
    var headers = {
        'content-type'  : 'application/json',
        'charset'       : 'utf-8',
        'content-length': Buffer.byteLength(params.json)
    };
    if (params.authorization) {
        headers['authorization'] = params.authorization;
    }
    var options = {
        host   : params.host,
        port   : params.port,
        method : 'POST',
        headers: headers,
        path   : params.fullPath
    };

    var callbackResponse = function (res) {
        var buffer = '';
        var err = null;
        var data;
        res.on('data', function (chunk) {
            buffer += chunk;
        });

        res.on('end', function () {
            if (res.statusCode !== 200) {
                err = {code: res.statusCode, msg: buffer};
                if (callback)  callback(err, null);
            }
            else {
                try {
                    data = JSON.parse(buffer);
                } catch (error) {
                    err = error;
                } finally {
                    if (callback)  callback(err, data);
                }
            }
        });
    };

    var request = http.request(options, callbackResponse);

    request.on('error', function (err) {
        if (callback) callback(err, null);
    });
    request.write(params.json);
    request.end();
}
