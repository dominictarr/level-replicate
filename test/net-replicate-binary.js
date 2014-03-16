console.log('NetReplicate_Binary')

var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var sub    = require('level-sublevel')
var u      = require('./util')

var d1     = sub(level('db1', {valueEncoding: 'binary'}))
var m1     = master(d1, 'master', 'M1')
var d2     = sub(level('db2', {valueEncoding: 'binary'}))
var m2     = master(d2, 'master', 'M2')

//d2.post(console.log)

var port   = ~~(10000 + Math.random()*50000)
var stream

var s1 = m1.createStream({tail: true})
var s2 = m2.createStream({tail: true})

s1.pipe(s2).pipe(s1)

var crypto = require('crypto')

function hash (val) {
  return crypto.createHash('sha1').update(''+val, 'utf8').digest()
}

var i = 0
u.generate(d1, {
  count: 1000,
  create: function () {
    var op = {key: 'key'+i, value: hash(i++), type: 'put'}
    return op
  }
}) (function () {
  setTimeout(function () {
    s1.end()
  }, 500)
})

//d2.put('y'+Math.random(), 'foo', function () {})

u.eventuallyConsistent(d1, d2, 100)

