/**
 * Author:      Evangelos Pappas
 * description:
 *
 */

exports.modSender = (function(){

    // settings prototype
    var __def = {
        token: {},
        sender: {},
        throttle: {
            time:1000,
            count:20
        },
        instanceID: 0,
        childOf: 0,
        splitCap: 1000,
        autoStop: false,
        onQueue: function(__this, messageID) {return messageID;},
        send: function(__this, messageID) {return messageID;},
        onDispatch: function(__this, messageID) {return messageID;},
        onSend: function(__this, messageID) {return messageID;},
        onStop: function(__this) {return __this;},
        onError: function(__this, messageID) {return messageID;}
    };

    // private singleton
    var senderQueue = {};

    /**
     *
     * @param args
     * @param portion
     * @return {*}
     * @constructor
     */
    function ModSender(args, portion) {
        this.__self = {
            token: (args.token ? args.token : __def.token),
            sender: (args.sender ? args.sender :  __def.sender),
            throttle: (args.throttle ? args.throttle : __def.throttle),
            instanceID: (args.instanceID ? args.instanceID : __def.instanceID),
            childOf: (args.childOf ? args.childOf : __def.childOf),
            splitCap: (args.splitCap ? args.splitCap : __def.splitCap),
            autoStop: (args.autoStop ? args.autoStop : __def.autoStop),
            onQueue: (args.onQueue ? args.onQueue : __def.onQueue),
            send: (args.send ? args.send : __def.send),
            onDispatch: (args.onDispatch ? args.onDispatch : __def.onDispatch),
            onSend: (args.onSend ? args.onSend : __def.onSend),
            onStop: (args.onSend ? args.onSend : __def.onStop),
            onError: (args.onError ? args.onError : __def.onError)
        };
        this.__childCount = 0;
        this.queue = (portion ? portion : []);
        this.__count = 0;
        return this;
    }

    /**
     * Gets the Token
     * @param time
     * @return {*}
     */
    ModSender.prototype.getToken = function() {
        return this.__self.token;
    };

    /**
     * Starts the interval whirl of this sender
     * @param time
     * @return {*}
     */
    ModSender.prototype.start = function(time) {
        var __this = this;
        setTimeout(function(){
            __this.__doSend();
        },(time || 1));
        return this;
    };

    /**
     * Private Function. The main logic of the sending whirl
     * @return {*}
     * @private
     */
    ModSender.prototype.__doSend = function() {
        var __this = this;
        __this.__self.instanceID = setInterval(function(){
            var obj = __this.queue.pop();
            if(obj !== null) {
                (function () {
                    this.do = function () {
                        var __innerThis = this;
                        try{
                            __this.__send.call(__this, __this, this.messageId, this.message, __this.__self.sender);
                            setTimeout(function(){
                                __this.__onDispatch.call(__this, __this, __innerThis.messageId, __innerThis.message);
                            },0);
                        }
                        catch(e) {
                            setTimeout(function(){
                                __this.__onError.call(__this, __this, __innerThis.messageId, __innerThis.message, e);
                            },0);
                        }
                    };
                    this.do.apply(this, arguments);
                }).call(obj,arguments);
            }
            else if(__this.queue.length === 0 && __this.__self.autoStop ) {
                __this.stop();
            }
        }, Math.round(this.__self.throttle.time / this.__self.throttle.count));
        senderQueue[__this.__self.instanceID] = this;
        return this;
    };

    /**
     * Called by Inner implementation to notify message's been served
     * @param messageId
     * @param message
     * @return {ModSender}
     */
    ModSender.prototype.sent = function(messageId, message) {
        var __this = this;
        setTimeout(function(){
            __this.__onSend.call(__this, __this, messageId, message);
        },0);
        return this;
    };

    /**
     * Called by Inner implementation to notify message's failure
     * @param messageId
     * @param message
     * @return {ModSender}
     */
    ModSender.prototype.failed = function(messageId, message, error) {
        var __this = this;
        setTimeout(function(){
            __this.__onError.call(__this, __this, messageId, message, error);
        },0);
        return this;
    };

    /**
     * Generates a child
     * @param token
     * @param throttle
     * @return {ModSender}
     */
    ModSender.prototype.newQueue = function(token, throttle) {
        return new ModSender({
            token: token,
            sender: this.__self.sender,
            throttle: throttle,
            instanceID: this.__countNewChild(),
            childOf: this.__self.instanceID,
            splitCap: this.__self.splitCap,
            autoStop: this.__self.autoStop,
            onQueue: this.__self.onQueue,
            send: this.__self.send,
            onDispatch: this.__self.onDispatch,
            onSend: this.__self.onSend,
            onStop: this.__self.onStop,
            onError: this.__self.onError
        });
    };

    /**
     * Generates a child to handle a portion
     * @param portion
     * @return {ModSender}
     * @private
     */
    ModSender.prototype.__split = function(portion) {
        return new ModSender({
            token: this.__self.token,
            sender: this.__self.sender,
            throttle:this.__self.throttle,
            instanceID: this.__countNewChild(),
            childOf: this.__self.instanceID,
            splitCap: this.__self.splitCap,
            autoStop: true,
            onQueue: this.__self.onQueue,
            send: this.__self.send,
            onDispatch: this.__self.onDispatch,
            onSend: this.__self.onSend,
            onStop: this.__self.onStop,
            onError: this.__self.onError
        },portion);
    };

    /**
     * To queue this message
     * @param message
     * @return {*}
     */
    ModSender.prototype.add = function(message) {
        this.__count = this.__count+1%1000;
        var obj = {
            messageId: this.__self.token+"-"+this.__msgIDTail(),
            message: message
        };
        this.queue.push(obj);

        // split the process to reduce overhead
        if(this.queue.length>this.__self.splitCap) {
            var portionInt = Math.round(this.queue.length/2);
            var arr = this.queue.slice(portionInt);
            this.queue = this.queue.slice(0, portionInt);
            this.__split(arr).start();//Math.round(this.__self.throttle.time / this.__self.throttle.count));
        }

        var __this = this;
        setTimeout(function(){
            __this.__onQueue(__this, obj.messageId, obj.message);
        },0);
        return this;
    };

    /**
     * Stops Sender in an asynchronous manner
     * @param time
     * @return {*}
     */
    ModSender.prototype.stop = function(time) {
        var __this = this;
        setTimeout(function(){
            clearInterval(__this.__self.instanceID);
            delete senderQueue[__this.__self.instanceID];
            __this.__onStop(__this, __this.queue);
        },(time || 1));
        return this;
    };

    /**
     * Abstract function, it is called a soon as a message is queued
     * @param __this
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.__onQueue = function(__this, messageID, message) {
        this.__self.onQueue(__this, messageID, message);
        return this;
    };

    /**
     * Abstract function, is is called every time an interval is joined.
     * @param __this
     * @param messageID
     * @param message
     * @param sender
     * @return {*}
     */
    ModSender.prototype.__send = function(__this, messageID, message, sender) {
        this.__self.send(__this, messageID, message, sender);
        return this;
    };

    /**
     * Abstract function, it is called as soon as send() is called
     * @param __this
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.__onDispatch = function(__this, messageID, message) {
        this.__self.onDispatch(__this, messageID, message);
        return this;
    };

    /**
     * Abstract function, called in the implementation flow when the message has finally served
     * @param __this
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.__onSend = function(__this, messageID, message) {
        this.__self.onSend(__this, messageID, message);
        return this;
    };

    /**
     * Called as soon as the Sender has trigger its stop method
     * @param __this
     * @param queue
     * @return {*}
     * @private
     */
    ModSender.prototype.__onStop = function(__this, queue) {
        this.__self.onStop(__this, queue);
        return this;
    };

    /**
     * Abstract function, it is called when an error is caught during send()ing
     * @param __this
     * @param messageID
     * @param message
     * @param err
     * @return {*}
     */
    ModSender.prototype.__onError = function(__this, messageID, message, err) {
        this.__self.onError(__this, messageID, message, err);
        return this;
    };

    /**
     * Abstract function, it is called a soon as a message is queued
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.onQueue = function(func) {
        this.__self.onQueue = func;
        return this;
    };

    /**
     * Abstract function, is is called every time an interval is joined.
     * @param messageID
     * @param message
     * @param sender
     * @return {*}
     */
    ModSender.prototype.send = function(func) {
        this.__self.send = func;
        return this;
    };

    /**
     * Abstract function, it is called as soon as send() is called
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.onDispatch = function(func) {
        this.__self.onDispatch = func;
        return this;
    };

    /**
     * Abstract function, called in the implementation flow when the message has finally served
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.onSend = function(func) {
        this.__self.onSend = func;
        return this;
    };

    /**
     * this method is triggered a soon as the stop() method is called
     * @param messageID
     * @param message
     * @return {*}
     */
    ModSender.prototype.onStop = function(func) {
        this.__self.onStop = func;
        return this;
    };

    /**
     * Abstract function, it is called when an error is caught during send()ing
     * @param messageID
     * @param message
     * @param err
     * @return {*}
     */
    ModSender.prototype.onError = function(func) {
        this.__self.onError = func;
        return this;
    };

    ModSender.prototype.__msgIDTail = function() {
        return ""+Date.now()+""+this.__count;
    };

    ModSender.prototype.__countNewChild = function() {
        this.__childCount = this.childCount+1%1000;
        return this.__childCount;
    };

    return ModSender;
})();
