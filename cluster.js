var os = require('os');
var cluster = require('cluster');

var args = process.argv;
var file = 'server.js';
var forks = os.cpus().length;

if(args.length > 2) {
    file = args[2];
    forks = args[3] || os.cpus().length;
}

cluster.setupMaster({
  exec: file
});

cluster.on('exit', function(worker) {
  console.error('Server ' + file + ' : ' + worker.id + ' passed away');
  cluster.fork();
});

for (var i = 0; i < forks; i++) {
  cluster.fork();
}
