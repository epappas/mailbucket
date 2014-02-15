var System = require("../../lib/system");
var reflectionDAO = require("./dao");

module.exports = (function() {


    var reflection = reflectionDAO();

    return {
        storeReflection: function(msg, thumbSize) {
            System.redis.hset("reflections", msg.token, msg.path);
            return reflection.put(msg, thumbSize);
        }
    };
});
