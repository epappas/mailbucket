var System = require("../../lib/js");
var pledge = require("../../lib/pledge.js");

module.exports = (function() {

    var modQuery = System.modQuery;

    function storeMessageReflectionFull(msg, deferred) {
        return modQuery.newModQuery()
        .executeSQL('' +
        'INSERT INTO message_reflections VALUES("", (SELECT `id` from `users_inbox` WHERE `messageId` = "' + msg.token + '"), ' +
        '"' + msg.token + '", "full", "' + msg.path + '" );',
        function (rows, err, sql) {
            if (err) {
                deferred.reject(err, sql);
                return console.log(sql, err);
            }
            deferred.resolve(rows);
        });
    }

    function storeMessageReflection(msg, thumbSize, deferred) {
        return modQuery.newModQuery()
        .executeSQL('' +
        'INSERT INTO message_reflections VALUES("", (SELECT `id` from `users_inbox` WHERE `messageId` = "' + msg.token + '"), ' +
        '"' + msg.token + '", "' + thumbSize[0] + "x" + thumbSize[1] + '", ' +
        '"' + msg.path.replace("full", thumbSize[0] + "x" + thumbSize[1]) + '" );',
        function (rows, err, sql) {
            if (err) {
                deferred.reject(err, sql);
                return console.log(sql, err);
            }
            deferred.resolve(rows);
        });
    }

    return {
        put: function(msg, thumbSize) {
            return pledge(function(deferred) {
                if(thumbSize) return storeMessageReflection(msg, thumbSize, deferred);

                storeMessageReflectionFull(msg, deferred);
            });
        }
    };
});
