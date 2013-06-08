
var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var sub    = require('level-sublevel')
var u      = require('./util')
var para   = require('continuable-para')

var d1     = sub(level('db1'))
var m1     = master(d1, 'master', 'M1')
var d2     = sub(level('db2'))
var m2     = master(d2, 'master', 'M2')
var d3     = sub(level('db3'))
var m3     = master(d3, 'master', 'M3')

var port   = ~~(10000 + Math.random()*50000)
var stream1, stream2

var server = net.createServer(function (stream) {
  stream.pipe(m3.createStream({tail: true})).pipe(stream)
  stream.on('data', function (data) {
    console.log('DATA:', data.toString())
  })
}).listen(port, function () {
  stream1 = net.connect(port)
  stream1.pipe(m1.createStream({tail: true})).pipe(stream1)
  stream2 = net.connect(port)
  stream2.pipe(m2.createStream({tail: true})).pipe(stream2)
})


para(
  u.generate(d1),
  u.generate(d2)
) (function () {
    setTimeout(function () {
      stream1.end()
      stream2.end()
      server.close()
    }, 100)
  })

u.eventuallyConsistent(d1, d2)
u.eventuallyConsistent(d1, d3)
u.eventuallyConsistent(d2, d3)

