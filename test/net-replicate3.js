var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var u      = require('./util')

var d1     = level('db1')
var m1     = master(d1, 'master', 'M1')
var d2     = level('db2')
var m2     = master(d2, 'master', 'M2')
var d3     = level('db3')
var m3     = master(d3, 'master', 'M3')

var port   = ~~(10000 + Math.random()*50000)
var stream1, stream2

var s1 = m1.createStream({tail: true})
var s2 = m2.createStream({tail: true})

s1.pipe(s2).pipe(s1)

var s3 = m1.createStream({tail: true})
var s4 = m3.createStream({tail: true})

s3.pipe(s4).pipe(s3)

u.generate(d1)
  (function () {
    setTimeout(function () {
      s1.end(); s3.end()
    }, 100)
  })

u.eventuallyConsistent(d1, d2)
u.eventuallyConsistent(d1, d3)
u.eventuallyConsistent(d2, d3)

