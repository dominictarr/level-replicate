var levelup  = require('levelup')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('../')
var name     = require('random-name')
var LiveStream = require('level-live-stream')

var db = SubLevel(levelup('/tmp/example-master'))

var master = Master(db, 'master')

//createServer(db, master)
net.createServer(function (stream) {
  stream.pipe(master.createStream({tail: true})).pipe(stream)
  stream.on('close', function () {
    console.log('DISCONNECT')
  })
}).listen(9999, function () {
  console.log('master db listening on 9999')
})

db.post(console.log)
//master.post(console.log)

LiveStream(master, {start: '0',
tail: false}).on('data', console.log)

setInterval(function () {
  var key = name()
  var val = new Date().toString()
  db.put(key, val, function (err) {
    if(err) throw err
  })
}, 1000)
