var level  = require('level')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('../')
var name     = require('random-name')

var pull     = require('pull-stream')
var pl       = require('pull-level')

var db = SubLevel(level('/tmp/example-master'))

var master = Master(db, 'master', "M1")

//createServer(db, master)
net.createServer(function (stream) {
  var ms
  stream.pipe(ms = master.createStream({tail: true})).pipe(stream)
  stream.on('end', function () {
//    ms.destroy()
    console.log('END')
  })
}).listen(9999, function () {
  console.log('master db listening on 9999')
})

//db.post(console.log)
master.post(console.log)

var i = 0
var ts = 0
var int = setInterval(function () {
  ts = ts || Date.now()
  var key = name()
  var val = new Date().toString()
  db.put(key, val, function (err) {
    if(err) throw err
  })

  if(i++ > 3) {
//    clearInterval(int)
    return
    master.createPullStream({tail: true, since: ts})
//    pl.read(db, {tail: true})
      .pipe(pull.log())
  }
}, 1000)
