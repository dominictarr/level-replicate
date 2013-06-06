var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var sub    = require('level-sublevel')

var d1     = sub(level('db1'))
var m1     = master(d1, 'master', 'M1')

var d2     = sub(level('db2'))
var m2     = master(d2, 'master', 'M2')

var port   = ~~(100000 + Math.random()*50000)
var stream 
var server = net.createServer(function (stream) {
  stream.pipe(m1.createStream({tail:true})).pipe(stream)
}).listen(port, function () {
  stream = net.connect(port)
  stream.pipe(m2.createStream({tail:true})).pipe(stream)
})

d2.post(console.error.bind(null, '<<<'))

var i = 10
var int = setInterval(function () {
  console.log('.')
  d1.put('x'+Math.random(), new Date(), function (){})
  if(--i) return
  clearInterval(int)
  server.close()
  stream.destroy()
}, 500)
