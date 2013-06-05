
var path = '/tmp/test-level-master'
var path2 = '/tmp/test-level-slave'

require('rimraf').sync(path)
require('rimraf').sync(path2)

var levelup = require('levelup')
var SubLevel = require('level-sublevel')

var db     = SubLevel(levelup(path))
var _db    = SubLevel(levelup(path2))

var Master = require('../')
var pull   = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var zip    = require('pull-zip')
var pl = require('pull-level')


var para     = require('continuable-para')
var series   = require('continuable-series')

var master   = require('../')

function all (db) {
  return function (cb) {
    pl.read(db, {min:'', max: '\xff\xff'})
      .pipe(pull.reduce(function (all, op) {
        all[op.key] = op.value
        return all
      }, {}, cb))
  }
}


var help   = require('./helper')
var test   = require('tape')

var master = Master(db, 'master', 'TEST1')

slave = Master(_db, 'master', 'TEST2')

test('setup', function (t) {
  help.populate(db, 20, function () {
    t.end()
  })
})

process.on('uncaughtException', console.error)

test('createPullStream', function (t) {
  //replicate!

  master.createMasterStream({clock: {}})
//  .pipe(pull.through(console.log.bind(null, '>')))
  .pipe(slave.createSlaveStream(function (err) {

    if(err) throw err

    console.log('REP')

    para(all(db), all(db)) (function (err, all) {
      t.notOk(err)
      t.deepEqual(all.shift(), all.shift())
      t.end()
    })
  }))
})

//master-slave replication must pull from master.
//connect to master, copy current since value.


