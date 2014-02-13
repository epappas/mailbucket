/*
 * Copyright (c) 2013. Developer Evangelos Pappas
 */

var page = require('webpage').create();
var system = require('system');
//var stdin = require('system').stdin;
var t = Date.now();
var token = system.args[1];
var address = system.args[2];
var assetsPath = system.args[3];
var start = Date.now();

if (system.args.length < 3) {
    console.error('Usage: phantom-call.js <token>', system.args);
    phantom.exit(1);
}

phantom.outputEncoding = "utf8";

page.customHeaders = {
    "Accept-Language": "el-gr;q=0.8,en-US;q=0.6,en;q=0.4"
};

page.open(address, function (status) {
    if (status !== 'success') {
        console.log(JSON.stringify({
            token  : token,
            time   : -1,
            message: "FAIL to load the address"
        }));
    }
    else {
        page.customHeaders = {"Accept-Charset": "utf-8"};
        page.clipRect = { top: 0, left: 0, width: 800, height: 494 };
        page.render(assetsPath + token + "-full.png");
        console.log(JSON.stringify({
            token  : token,
            path   : token + "-full.png",
            time   : Date.now() - t,
            message: "Rendered"
        }));
        phantom.exit(0);
    }
});
