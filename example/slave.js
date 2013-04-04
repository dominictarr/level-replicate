var levelup  = require('levelup')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('../')

var db = SubLevel(levelup('/tmp/example-slave'))
var slave = Master.Slave(db, 'slave')

var stream = net.connect(9999)

//stream.pipe(slave.createStream()).pipe(stream)

stream
.on('data', function (data) {
  console.log('>', data.toString())
})

stream.write('{"since": 0}\n\n')
// log inserts
db.post(console.log)


