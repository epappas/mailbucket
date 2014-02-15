/* global phantom */
var newPage = require('webpage').create;
var server = require('webserver').create();
var system = require('system');
var port = parseInt(system.args[1], 10);
var assetsPath = system.args[2];
var start = Date.now();


if (system.args.length < 3) {
    console.error('Usage: phantom-server.js <portnumber>', system.args);
    phantom.exit(1);
}

phantom.outputEncoding = "utf8";

server.listen(port, function (request, response) {
    response.statusCode = 200;
    response.headers = {
        'Cache'       : 'no-cache',
        'Content-Type': 'application/json'
    };

    var command = JSON.parse(request.headers.content, null, 4);

    switch(command.cmd) {
        case "render":
            doRender(command.address, command.token);
            break;
        case "quit":
            doQuit(response);
            break;
        default:
            console.log("{\"token\":\"failure\", \"path\":\"default.png\"}");
            break;
    }

    response.write(JSON.stringify({
        token: command.token,
        time: Date.now(),
        message: "Ok"
    }));
    response.close();
});

function doRender(address, token) {
    var page = newPage();
    var t = 0;
    page.customHeaders = {
        "Accept-Language": "el-gr;q=0.8,en-US;q=0.6,en;q=0.4"
    };
//  page.onResourceRequested = function (request) {
//      //console.log('Request ' + JSON.stringify(request, undefined, 4));
//  };
//  page.onResourceReceived = function (response) {
//      //console.log('Receive ' + JSON.stringify(response, undefined, 4));
//  };

    t = Date.now();
    page.open(address, function (status) {
        if (status !== 'success') {
            console.log(JSON.stringify({
                token: token,
                time: -1,
                message: "FAIL to load the address"
            }));
        }
        else {
            page.customHeaders = {"Accept-Charset":"utf-8"};
            page.clipRect = { top: 0, left: 0, width: 800, height: 494 };
            page.render(assetsPath+token+"-full.png");
            console.log(JSON.stringify({
                token: token,
                path: token+"-full.png",
                time: Date.now() - t,
                message: "Rendered"
            }));
        }
    });
}

function doQuit(response) {
    //clearInterval(interval);
    response.write(JSON.stringify({
        time: Date.now() - start,
        message: "Exit"
    }));
    response.close();
    phantom.exit(0);
}
