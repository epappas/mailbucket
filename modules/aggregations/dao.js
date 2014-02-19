var System = require("../../lib/js");
var parse = require("../../lib/modParse.js");
var path = require("path");

module.exports = (function() {

    var modQuery = System.modQuery;

    return {
        putDetail: function(token, message, callback) {
            modQuery.newModQuery()
            .insertInto("users_aggregations_messages")
            .insert("aggr_id", "(SELECT `id` from `users_aggregations` WHERE `key` = \"" + token + "\")")
            .insert("aggr_key", token)
            .insert("messageId", message.token + "")
            .insert("`index`", message.index)
            .insert("sender", parse.toDB(message.from))
            .insert("title", parse.toDB(message.subject))
            .insert("`excerpt`", parse.toDB(message.text))
            .insert("thumb", parse.toDB(message.imgUrl))
            .execute(callback);
        },
        put: function(email, callback) {
            modQuery.newModQuery()
            .insertInto("users_aggregations")
            .insert("`key`", email.token)
            .insert("`user_key`", email.uKey)
            .insert("`user_id`", "(SELECT `id` from `users` WHERE `key` = \"" + email.uKey + "\")")
            .insert("`interval`", Date.now())
            .insert("`path`", path.join(__dirname, System.conf.assets.aggregationPath + email.messageId + ".html"))
            .execute(callback);
        }
    };
});
