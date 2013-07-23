
var net    = require('net')
var master = require('../msgpack')
var level  = require('level-test')()
var sub    = require('level-sublevel')
var u      = require('./util')
var para   = require('continuable-para')

var d1     = sub(level('db1', {encoding: 'binary'}))
var m1     = master(d1, 'master', 'M1')
var d2     = sub(level('db2', {encoding: 'binary'}))
var m2     = master(d2, 'master', 'M2')

var d3     = sub(level('db3', {encoding: 'binary'}))
var m3     = master(d3, 'master', 'M3')

var port   = ~~(10000 + Math.random()*50000)
var stream1, stream2

var s1 = m1.createStream({tail: true})
var s2 = m3.createStream({tail: true})

s1.pipe(s2).pipe(s1)

//var s3 = m2.createStream({tail: true})
//var s4 = m3.createStream({tail: true})

//s3.pipe(s4).pipe(s3)

function d(n) {
  return function () {
    var i = 0
    return {
      key:''+n+i++,
      value: new Buffer('k'+ i++),
      type: 'put'
    }
  }
}

para(
  u.generate(d1, {create: d('a')}),
  u.generate(d3, {create: d('b')})
) (function () {
    setTimeout(function () {
      s1.end();
      //s3.end()
    }, 1000)
  })

//u.eventuallyConsistent(d1, d2)
u.eventuallyConsistent(d1, d3)
//u.eventuallyConsistent(d2, d3)

