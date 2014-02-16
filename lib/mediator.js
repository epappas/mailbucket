
module.exports = (function ( ) {
    'use strict';

    var globalScope = { };
    var channels = { };

    var Mediator = {

        subscribe: function(name, channel, handler, context, once) {
            channels[name] = channels[name] || { };
            channels[name][channel] = channels[name][channel] || [ ];

            channels[name][channel].push({fn: handler, context: context || this, once: once});
            return this;
        },

        publish: function(name, channel) {
            if (!channels[name] || !channels[name][channel]) return;

            var args = [ ].slice.call(arguments, 2);

            channels[name][channel].forEach(function(handler) {
                handler.fn.apply(handler.context, args);
            });
            channels[name][channel] = channels[name][channel].filter(function(handler) {
                return (!handler.once? true : false);
            });
            return this;
        },

        onRequest: function(name, channel, handler) {
            channels[name] = channels[name] || { };
            channels[name][channel] = channels[name][channel] || [ ];

            channels[name][channel].push({fn: handler, context: this, once: false});
            return this;
        },

        request: function(name, channel) {
            if (!channels[name] || !channels[name][channel]) return;

            var args = [ ].slice.call(arguments, 2);

            if(typeof args[args.length - 1] !== "function") throw new Error("The last argument of request() must be a function");

            channels[name][channel].forEach(function(handler) {
                handler.fn.apply(handler.context, args);
            });
            return this;
        },

        unsubscribe: function(name, channel, fn, context){
            if (!channels[name] || !channels[name][channel]) return;

            channels[name][channel] = channels[name][channel].filter(function(handler) {
                return (handler.fn !== fn && handler.context !== context);
            });
            return this;
        },

        once: function (name, channel, handler, context) {
            Mediator.subscribe(name, channel, handler, context, true);
            return this;
        }

    };

    return {
        extent: function(name, module) {
            module.subscribe = Mediator.subscribe.bind(module, name);
            module.publish = Mediator.publish.bind(module, name);
            module.unsubscribe = Mediator.unsubscribe.bind(module, name);
            module.onRequest = Mediator.onRequest.bind(module, name);
            module.request = Mediator.request.bind(module, name);
            module.once = Mediator.once.bind(module, name);
            return module;
        },
        subscribe: function() {
            return Mediator.subscribe.apply(globalScope, __formatArgs([ ].slice.call(arguments, 0)));
        },
        publish: function() {
            return Mediator.publish.apply(globalScope, __formatArgs([ ].slice.call(arguments, 0)));
        },
        unsubscribe: function() {
            return Mediator.unsubscribe.apply(globalScope, __formatArgs([ ].slice.call(arguments, 0)));
        },
        onRequest: function() {
            return Mediator.onRequest.apply(globalScope, __formatArgs([ ].slice.call(arguments, 0)));
        },
        request: function() {
            return Mediator.request.apply(globalScope, __formatArgs([ ].slice.call(arguments, 0)));
        },
        once: function() {
            return Mediator.once.apply(globalScope, __formatArgs([ ].slice.call(arguments, 0)));
        }
    };

    function __formatArgs(args) {
        var splitted = args.shift().split(':');

        if(splitted.length <= 1) {
            splitted[1] = splitted[0];
            splitted[0] = 'global';
        }

        return [ ].concat(splitted, args);
    }

})( );
