var net    = require('net')
var master = require('../')
var level  = require('level-test')()
var u      = require('./util')

var d1     = level('db1')
var m1     = master(d1, 'master', 'M1')
var d2     = level('db2')
var m2     = master(d2, 'master', 'M2')

var port   = ~~(10000 + Math.random()*50000)

u.generate(d1, {
  count: 10,
  interval: 10,
  prefix: 'a',
  }) (function () {

    var s1 = m1.createStream({tail: true})
    var s2 = m2.createStream({tail: true})

    s1.pipe(s2).pipe(s1)

    u.generate(d2, {
      prefix: 'b',
    }) (function () {
          setTimeout(function () {
            s1.end()
          }, 100)    
        })

    })

u.eventuallyConsistent(d1, d2)

