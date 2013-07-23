var level    = require('level-test')()
var test     = require('tape')
var sublevel = require('level-sublevel')
var pl       = require('pull-level')
var pull     = require('pull-stream')
var para     = require('continuable-para')
var series   = require('continuable-series')

var master   = require('../')

var all      = require('./util').all

function put (db, key, value) {
  return function (cb) {
    db.put(key, value, cb)
  }
}

function replicate (m1, m2) {
  return function (cb) {
    m1.createMasterStream()
      .pipe(m2.createSlaveStream(cb))
  }
}

test('replicate', function (t) {
  var db1 = sublevel(level('replicate_1'))
  var db2 = sublevel(level('replicate_2'))

  var m1 = master(db1, 'master', "M1")
  var m2 = master(db2, 'master', "M2")

  series(
    put(db1, 'foo', new Date()),
    replicate(m1, m2),
    para(all (db1), all(db2))
  ) (function (err, all) {
      t.notOk(err)
      //assert that both databases are equal!
      console.log(all)
      t.deepEqual(all[0], all[1])
      t.end()
    })

})

test('replicate 2', function (t) {

  var db1 = sublevel(level('replicate2_1'))
  var db2 = sublevel(level('replicate2_2'))

  var m1 = master(db1, 'master', "M1")
  var m2 = master(db2, 'master', "M2")

  series(
    para(
      put(db1, 'foo', new Date()),
      put(db2, 'bar', new Date())
    ),
    para(replicate(m1, m2), replicate(m2, m1)),
    para(all (db1), all(db2))
  ) (function (err, all) {
      t.notOk(err)
      //assert that both databases are equal!
      console.log(all)
      t.deepEqual(all[0], all[1])
      t.end()
    })

})

test('replicate 3', function (t) {

  var db1 = sublevel(level('replicate3_1'))
  var db2 = sublevel(level('replicate3_2'))
  var db3 = sublevel(level('replicate3_3'))

  var m1 = master(db1, 'master', "M1")
  var m2 = master(db2, 'master', "M2")
  var m3 = master(db3, 'master', "M3")

  series (
    para (
      put (db1, 'foo', new Date()),
      put (db2, 'bar', new Date()),
      put (db3, 'baz', new Date())
    ),
    para (replicate(m1, m2), replicate(m2, m1)),
    para (replicate(m2, m3), replicate(m3, m2)),
    para (replicate(m1, m3), replicate(m3, m1)),
    para (all(db1), all (db2), all(db3))
  ) (function (err, all) {
      t.notOk(err)
      //assert that both databases are equal!
      console.log(all)
      t.deepEqual(all[0], all[1])
      t.deepEqual(all[0], all[2])
      t.end()
    })

})


