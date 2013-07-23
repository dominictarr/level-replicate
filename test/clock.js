
var level    = require('level-test')()
var test     = require('tape')
var sublevel = require('level-sublevel')
var master   = require('../')
var timestamp = require('monotonic-timestamp')

test('vector clock', function (t) {
  var db = sublevel(level('vectorClock'))

  var masterDb = master(db, 'master', 'TEST')

  var ts = timestamp()

  db.put('foo', 'bar', function (err) {
    t.notOk(err)

    masterDb.clock(function (err, clock) {
      t.notOk(err)
      t.ok(clock.TEST > ts)
      console.log([clock, ts])
      t.end()
    })
  })
})

//add more tests once there are multiple databases that can replicate.
