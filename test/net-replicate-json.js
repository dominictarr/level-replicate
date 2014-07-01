console.log('NetReplicate JSON')

var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var sub    = require('level-sublevel')
var u      = require('./util')
var para   = require('continuable-para')

var d1     = sub(level('dbjson1', {valueEncoding: 'json'}))
var m1     = master(d1, 'master', 'M1')
var d2     = sub(level('dbjson2', {valueEncoding: 'json'}))
var m2     = master(d2, 'master', 'M2')
var d3     = sub(level('dbjson3', {valueEncoding: 'json'}))
var m3     = master(d3, 'master', 'M3')

var port   = ~~(10000 + Math.random()*50000)

var s1 = m3.createStream({tail: true})
var s2 = m1.createStream({tail: true})

s1.pipe(s2).pipe(s1)

var s3 = m2.createStream({tail: true})
var s4 = m3.createStream({tail: true})

s3.pipe(s4).pipe(s3)

para(
  u.generate(d1),
  u.generate(d2)
) (function () {
    setTimeout(function () {
      s1.end(); s3.end(); s2.end()
    }, 100)
  })

u.eventuallyConsistent(d1, d2)
u.eventuallyConsistent(d1, d3)
u.eventuallyConsistent(d2, d3)
