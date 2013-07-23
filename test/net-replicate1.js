require('util')

var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var sub    = require('level-sublevel')
var u      = require('./util')

var d1     = sub(level('db1'))
var m1     = master(d1, 'master', 'M1')
var d2     = sub(level('db2'))
var m2     = master(d2, 'master', 'M2')

var port   = ~~(10000 + Math.random()*50000)

var s1 = m1.createStream({tail: true})
var s2 = m2.createStream({tail: true})

s1.pipe(s2).pipe(s1)

u.generate(d1) (function () {
  setTimeout(function () {
    s1.end()
  }, 100)
})

d2.put('y'+Math.random(), 'foo', function () {})

u.eventuallyConsistent(d1, d2)

