var level = require('level-test')()
  , replicate = require('../')
  , sublevel = require('level-sublevel')
  , test = require('tape')
  , opts = {keyEncoding: 'utf8', valueEncoding: 'json'}

var db1, db2, m1, m2;

test('fills', function (t) {
  db1 = sublevel(level('test-replicate_db1', opts))
  db2 = sublevel(level('test-replicate_db2', opts))
  m1 = replicate(db1, 'master', 'M1')
  m2 = replicate(db2, 'master', 'M2')

  // add one document
  db1.put('foo', {bar: 'baz'}, function (err) {
    if (err) console.log('err', err);
    db1.close(function(){
      db2.close(function(){
        t.end()
      })
    })
  });
})

// store the data that is sent from one master to the other
var wireData = {}

var run = function (key) {
  test('replicates' + key, function (t) {
    opts.clean = false
    db1 = sublevel(level('test-replicate_db1', opts))
    db2 = sublevel(level('test-replicate_db2', opts))
    m1 = replicate(db1, 'master', 'M3')
    m2 = replicate(db2, 'master', 'M4')

    // replicate databases
    m1s = m1.createStream({tail: true})
    m1s.pipe(m2.createStream({tail: true})).pipe(m1s)
    m1s.on('data', function(data){
      wireData[key] = wireData[key] || {};
      wireData[key][data] = true;
    })

    setTimeout(function () {
      // collect result
      var db1result = ''
      var db2result = ''

      db1.createReadStream().on('data', function(data){
        console.log(data)
        db1result += JSON.stringify(data)
      })
      db2.createReadStream().on('data', function(data){
        db2result += JSON.stringify(data)
      })

      setTimeout(function () {
        // console.log('RESULTS\n', db1result, '\n', db2result)
        t.ok(db1result, 'db1 has content')
        t.equal(db1result, db2result, 'contents matches')

        db1.close(function(){
          db2.close(function(){
            t.end()
          })
        })
      }, 1000)
    }, 1000)
  })
}

// replicate several times
run('1')
run('2')
run('3')
run('4')

test('only info about key "foo" is sent', function(t){
  keys = []
  for (k in wireData) {
    for (kk in wireData[k]) {
      var obj = JSON.parse(kk)
      console.log('result:', k, obj)
      // ignore anything without 'key' set
      if (obj.key) keys.push(obj.key);
    }
  }
  // there should be only one key: foo
  console.log('result:', keys)
  t.equal(keys.length, 1)
  t.equal(keys[keys.length-1], 'foo')
  t.end()
})
