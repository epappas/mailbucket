var mediator = require("../lib/mediator");


var Factory = (function() {
    function Test(name) {
        this.name = name;
    }
    Test.prototype.myName = function() {
        return this.name;
    };
    return Test;
})();

var A = new Factory("moduleA");
var B = new Factory("moduleB");
var C = new Factory("moduleC");

A = mediator.extent("A", A);
B = mediator.extent("B", B);
C = mediator.extent("C", C);

// ------------
A.onRequest('name', function(request, callback) {
    console.log('A was requested; ' + request);
    callback(null, this.name);
});
B.onRequest('name', function(request, callback) {
    console.log('B was requested; ' + request);
    callback(null, this.name);
});
C.onRequest('name', function(request, callback) {
    console.log('C was requested; ' + request);
    callback(null, this.name);
});

// ------------
A.subscribe("newVal", function(val) {
    console.log('Module: ' + this.name + ' Published ' + val);
});
B.subscribe("newVal", function(val) {
    console.log('Module: ' + this.name + ' Published ' + val);
});
C.subscribe("newVal", function(val) {
    console.log('Module: ' + this.name + ' Published ' + val);
});

// ------------
mediator.subscribe('A:newVal', function(val) {
     console.log('Out of nowhere I receved ' + val + ' From A');
});
mediator.subscribe('B:newVal', function(val) {
     console.log('Out of nowhere I receved ' + val + ' From B');
});
mediator.subscribe('C:newVal', function(val) {
     console.log('Out of nowhere I receved ' + val + ' From C');
});

// ------------
A.request('name', Date.now(), function(err, val) {
    console.log('Request from A resulted; ', err, val);
});
B.request('name', Date.now(), function(err, val) {
    console.log('Request from B resulted; ', err, val);
});
C.request('name', Date.now(), function(err, val) {
    console.log('Request from C resulted; ', err, val);
});

// ------------
A.publish('newVal', Date.now() + ' MyName: ' + A.myName());
B.publish('newVal', Date.now() + ' MyName: ' + B.myName());
C.publish('newVal', Date.now() + ' MyName: ' + C.myName());
