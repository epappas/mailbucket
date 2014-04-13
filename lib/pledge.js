/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */

var events = require('events');
// Fallback support
var async = (typeof setImmediate === "function" ? setImmediate :
    (typeof process !== "undefined" && typeof process.nextTick === "function" ? process.nextTick : setTimeout));

var unboundSlice = Array.prototype.slice;
var slice = Function.prototype.call.bind(unboundSlice);

var Pledge = (function() {
    "use strict";

    var states = [
        'pending',
        'fulfilled',
        'rejected'
    ];

    function Pledge(fn, err, isHead) {
        var __this = this;
        if (typeof err === "function") {
            this.onError = function(e) {
                __this.state = states[2];
                __this.reason = e;
                return err;
            };
        } else {
            this.onError = function(e) {
                __this.state = states[2];
                __this.reason = e;
                // console.error(e, e.stack);
            };
        }

        if(typeof fn !== 'function') {
            this.origin = function(deferred) {
                return deferred.resolve(fn);
            };
        }
        else {
            this.origin = fn;
        }

        this.wireTapArr = [];
        this.progressHandlers = [];
        this.next = null;
        this.state = states[0];
        this.value = null;
        this.reason = null;

        if(__isPromise(this.origin)) {
            this.origin.then(function() {
                try {
                    __this.origin.call(__this, __this);
                } catch (e) {
                    __this.onError(e);
                }
            });
        }
        else if (isHead) {
            async(function() {
                try {
                    __this.origin.call(__this, __this);
                } catch (e) {
                    __this.onError(e);
                }
            });
        }
        return this;
    }

    // inherit
    (function(father) {
        // I am your Father!
        this.prototype = father;
        return this;
    }).call(Pledge, new events.EventEmitter());

    Pledge.prototype.resolve = function() {
        var __this = this;
        var args = slice(arguments, 0);

        this.state = states[1];
        this.value = args[0];

        // execute next
        async((function(target, data) {
            if (target === null) return;
            try {
                target.origin.apply(target, data.concat(target.resolve.bind(target)));
            } catch (e) {
                target.onError(e);
            }
        }).bind(__this, __this.next, args));

        // a weird loop to handle failures - it might scale to asynchronous in the future
        (function __loop(index, fArr, data) {
            if (!fArr[index]) return;
            try {
                fArr[index].apply(null, data);
            } catch (e) {
                __this.onError(e);
            }
            __loop(++index, fArr, data);
        })(0, this.wireTapArr, args);
        return this;
    };

    Pledge.prototype.progress = function(progress) {
        var __this = this;

        (function __loop(index, fArr, progress) {
            if (!fArr[index]) return;
            try {
                fArr[index].call(null, progress);
            } catch (e) {
                __this.onError(e);
            }
            __loop(++index, fArr, progress);
        })(0, this.progressHandlers, progress);

        return this;
    };

    Pledge.prototype.onProgress = function(listener) {
        this.progressHandlers.push(listener);
        return this;
    };

    Pledge.prototype.reject = function() {
        this.onError.apply(null, slice(arguments, 0));
        return this;
    };

    Pledge.prototype.wireTap = function(fn) {
        if (Array.isArray(fn)) {
            var __this = this;
            fn.map(function(f) {
                __this.wireTapArr.push((f || function() {}).bind(__this, __this));
                return f;
            });
            return this;
        }
        this.wireTapArr.push((fn || function() {}).bind(this, this));
        return this;
    };

    Pledge.prototype.then = function(fn, err) {
        // push to the bottom of the stack - as a linked list
        return (function __loop(target, fn, err) {
            if (target.next !== null) {
                return __loop(target.next, fn, err);
            }
            target.next = new Pledge(fn, err);
            return target.next;
        })(this, fn, err);
    };

    return Pledge;
})(process || window);

module.exports = function(fn, err) {
    "use strict";
    return new Pledge((fn || function() {}), err, true);
};

module.exports.nfapply = function(callback, args) {
    return new Pledge(function(args) {
        return callback.apply(callback, args);
    }.bind(callback, args), null, true);
};

module.exports.nfcall = function(fn) {
    return new Pledge(function(args, deferred) {
        return fn.apply(fn, args.concat(function(err, val) {
            if(err) return deferred.reject(err);
            return deferred.resolve(val);
        }));
    }.bind(fn, slice(arguments, 1)), null, true);
};

module.exports.map = function(arr, fn, err) {
    "use strict";
    return new Pledge(function(myPledge) {
        (function __loop(index, arr, fn, err) {
            if (index >= arr.length) {
                myPledge.resolve(arr);
                return;
            }

            try {
                arr[index] = fn.call(arr, arr[index], index, arr);
                async(__loop.bind(myPledge, ++index, arr, fn, err));
            } catch (e) {
                if (typeof err === "function") {
                    err(e.index);
                } else {
                    // console.error(e, e.stack);
                }
            }
        })(0, arr, fn, err);
    }, err, true);
};

module.exports.lazyMap = function(arr, fn, err) {
    "use strict";
    return new Pledge(function(myPledge) {
        (function __loop(index, arr, fn, err) {
            if (index >= arr.length) {
                myPledge.resolve(arr);
                return;
            }

            try {
                fn.call(arr, arr[index], index, (function(arr, index, value) {
                    arr[index] = value;
                    async(__loop.bind(myPledge, ++index, arr, fn, err));
                }).bind(arr, arr, index));
            } catch (e) {
                if (typeof err === "function") {
                    err(e.index);
                } else {
                    // console.error(e, e.stack);
                }
            }
        })(0, arr, fn, err);
    }, err, true);
};

module.exports.range = function(min, max, fn, err) {
    "use strict";
    return new Pledge(function(myPledge) {
        (function __loop(index, max, arr, fn, err) {
            if (index >= max) {
                myPledge.resolve(arr);
                return;
            }

            try {
                arr.push(fn.call(arr, index));
                async(__loop.bind(myPledge, ++index, max, arr, fn, err));
            } catch (e) {
                if (typeof err === "function") {
                    err(e, index);
                } else {
                    // console.error(e, e.stack);
                }
            }
        })(min, max, [], fn, err);
    }, err, true);
};

module.exports.lazyRange = function(min, max, fn, err) {
    "use strict";
    return new Pledge(function(myPledge) {
        (function __loop(index, max, arr, fn, err) {
            if (index >= max) {
                myPledge.resolve(arr);
                return;
            }

            try {
                fn.call(arr, index, (function(arr, index, value) {
                    arr[index] = value;
                    async(__loop.bind(myPledge, ++index, max, arr, fn, err));
                }).bind(arr, arr, index));
            } catch (e) {
                if (typeof err === "function") {
                    err(e, index);
                } else {
                    // console.error(e, e.stack);
                }
            }
        })(min, max, [], fn, err);
    }, err, true);
};

function __isPromise(obj) {
    return typeof obj.then === "function";
}

