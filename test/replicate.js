var path = '/tmp/test-level-master'
var path2 = '/tmp/test-level-slave'

require('rimraf').sync(path)
require('rimraf').sync(path2)

var levelup = require('levelup')
var SubLevel = require('level-sublevel')

var db   = SubLevel(levelup(path))
var _db  = SubLevel(levelup(path2))

var Master = require('../')
var pull   = require('pull-stream')

var help   = require('./helper')

var test   = require('tape')

var master = Master(db, 'master', 'T1')

slave = Master(_db, 'master', 'T2')

test('setup', function (t) {
  help.populate(db, 100, function (err) {
    t.notOk(err)
    t.end()
  })
})

//master-slave replication must pull from master.
//connect to master, copy current since value.


test('createStream', function (t) {

  slave.clock(function (err, clock) {
    t.deepEqual(clock, {})

    console.log('PULL STREAM SINCE:', clock)
    master.createMasterStream()
      .pipe(pull.through(function (data) {
        t.ok(data.ts > clock, data.ts + ' > ' + clock)
      }))
      .pipe(slave.createSlaveStream(function (err) {
        //*********************************
        //SOME TIMES THIS DOESN"T HAPPEN????
        //*********************************
        t.end()
      }))
  })
})

return
test('updates', function (t) {
  help.populate(db, 100, function (err) {
    t.notOk(err)
    t.end()
  })
})

test('createStream2', function (t) {

  slave.clock(function (err, clock) {

    t.notEqual(since, 0)

    console.log('PULL STREAM SINCE:', since)
    master.createMasterStream({clock: clock})
      .pipe(pull.through(function (data) {
        t.ok(data.ts > since, data.ts + ' > ' + since)
      }))
      .pipe(slave.createSlaveStream(function (err) {
        if(err) throw err
        help.hash(db, function (err, sum) {
          help.hash(_db, function (err, _sum) {
            console.log(sum, _sum)
            t.equal(sum, _sum)
            t.end()
          })
        })
      }))
  })
})

