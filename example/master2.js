var level  = require('level')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('../')

var db = SubLevel(level('/tmp/example-slave'))
var master = Master(db, 'master', 'M2')

var stream = net.connect(9999)


stream.pipe(master.createStream({tail: true})).on('data', console.log).pipe(stream)

db.post(console.log)

//stream
//.on('data', function (data) {
//  console.log('>', data.toString())
//})

//stream.write('{"since": 0}\n\n')
// log inserts
//db.post(console.log)


