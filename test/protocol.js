var level    = require('level-test')()
var test     = require('tape')
var sublevel = require('level-sublevel')
var master   = require('../')
var pull     = require('pull-stream')

test('protocol', function (t) {
  var db = sublevel(level('protocol-1'))

  var masterDb = master(db, 'master', 'TEST')

  var ts = Date.now()

  db.put('foo', 'bar', function (err) {
    t.notOk(err)

    var n = 2

    masterDb.createMasterStream({clock: {TEST: 0}})
      .pipe(pull.collect(function (err, all) {
        t.notOk(err)
        console.log('1')
        t.equal(all.length, 1)
        t.equal(all[0].key, 'foo')
        t.equal(all[0].value, 'bar')
        next()
      }))

    masterDb.clock(function (err, clock) {
      masterDb.createMasterStream({clock: clock})
        .pipe(pull.collect(function (err, all) {
          console.log('2')
          console.log(all, clock)
          t.notOk(err)
          t.equal(all.length, 0)
          next()
        }))
    })
 
    function next () {
      if(--n) return
      t.end()
    }
  })
})

